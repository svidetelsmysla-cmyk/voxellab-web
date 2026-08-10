export type EquilibriumClass = "WELL" | "SADDLE" | "PEAK" | "NEUTRAL";
export type DisplayField = "EQUILIBRIUM" | "DENSITY" | "MU" | "FORCE";

export interface LiveReducedParams {
  n: 32 | 64;
  L: number;
  rho0: number;
  rhoMax: number;
  B: number;
  beta: number;
  gamma4: number;
  alpha: number;
  actionLambda: number;
  kappaScale: number;
  scatter: number;
  angularDirections: 4 | 8;
  actionRelaxIterations: number;
  actionRelaxation: number;
  dt: number;
  densityNoise: number;
  motionNoise: number;
  seed: number;
}

export interface LiveMetrics {
  time: number;
  steps: number;
  rhoMin: number;
  rhoMax: number;
  rhoMean: number;
  amountDrift: number;
  actionResidual: number;
  wellCells: number;
  saddleCells: number;
  peakCells: number;
  neutralCells: number;
  equilibriumCount: number;
  stoppedReason: string | null;
}

export interface EquilibriumMap {
  fx: Float64Array;
  fy: Float64Array;
  lambdaMin: Float64Array;
  lambdaMax: Float64Array;
  classes: Uint8Array;
  markers: Array<{ x: number; y: number; fx: number; fy: number; lambdaMin: number; lambdaMax: number; className: EquilibriumClass }>;
  forceScale: number;
  stiffnessScale: number;
}

interface ComplexField { re: Float64Array; im: Float64Array }

function clamp(value: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, value)); }
function isPowerOfTwo(n: number): boolean { return n > 0 && (n & (n - 1)) === 0; }

function fft1d(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / len;
    const wlenR = Math.cos(angle), wlenI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const uR = re[i + j]!, uI = im[i + j]!;
        const vr0 = re[i + j + len / 2]!, vi0 = im[i + j + len / 2]!;
        const vR = vr0 * wr - vi0 * wi, vI = vr0 * wi + vi0 * wr;
        re[i + j] = uR + vR; im[i + j] = uI + vI;
        re[i + j + len / 2] = uR - vR; im[i + j + len / 2] = uI - vI;
        const nextWr = wr * wlenR - wi * wlenI;
        wi = wr * wlenI + wi * wlenR; wr = nextWr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i += 1) { re[i] = re[i]! / n; im[i] = im[i]! / n; }
}

function fft2Real(input: Float64Array, n: number): ComplexField {
  const re = new Float64Array(input), im = new Float64Array(input.length);
  const rowR = new Float64Array(n), rowI = new Float64Array(n);
  for (let y = 0; y < n; y += 1) {
    const base = y * n;
    for (let x = 0; x < n; x += 1) { rowR[x] = re[base + x]!; rowI[x] = 0; }
    fft1d(rowR, rowI, false);
    for (let x = 0; x < n; x += 1) { re[base + x] = rowR[x]!; im[base + x] = rowI[x]!; }
  }
  const colR = new Float64Array(n), colI = new Float64Array(n);
  for (let x = 0; x < n; x += 1) {
    for (let y = 0; y < n; y += 1) { const idx = y * n + x; colR[y] = re[idx]!; colI[y] = im[idx]!; }
    fft1d(colR, colI, false);
    for (let y = 0; y < n; y += 1) { const idx = y * n + x; re[idx] = colR[y]!; im[idx] = colI[y]!; }
  }
  return { re, im };
}

function ifft2(field: ComplexField, n: number): Float64Array {
  const re = new Float64Array(field.re), im = new Float64Array(field.im);
  const rowR = new Float64Array(n), rowI = new Float64Array(n);
  for (let y = 0; y < n; y += 1) {
    const base = y * n;
    for (let x = 0; x < n; x += 1) { rowR[x] = re[base + x]!; rowI[x] = im[base + x]!; }
    fft1d(rowR, rowI, true);
    for (let x = 0; x < n; x += 1) { re[base + x] = rowR[x]!; im[base + x] = rowI[x]!; }
  }
  const colR = new Float64Array(n), colI = new Float64Array(n);
  for (let x = 0; x < n; x += 1) {
    for (let y = 0; y < n; y += 1) { const idx = y * n + x; colR[y] = re[idx]!; colI[y] = im[idx]!; }
    fft1d(colR, colI, true);
    for (let y = 0; y < n; y += 1) { const idx = y * n + x; re[idx] = colR[y]!; im[idx] = colI[y]!; }
  }
  return re;
}

function makeRandom(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) / 0xffffffff) * 2 - 1; };
}

function smoothPeriodic(values: Float64Array, n: number, passes: number): Float64Array {
  let src = new Float64Array(values), dst = new Float64Array(values.length);
  const idx = (x: number, y: number) => ((y + n) % n) * n + ((x + n) % n);
  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
      dst[y * n + x] = (4 * src[idx(x, y)]! + 2 * (src[idx(x - 1, y)]! + src[idx(x + 1, y)]! + src[idx(x, y - 1)]! + src[idx(x, y + 1)]!) + src[idx(x - 1, y - 1)]! + src[idx(x + 1, y - 1)]! + src[idx(x - 1, y + 1)]! + src[idx(x + 1, y + 1)]!) / 16;
    }
    [src, dst] = [dst, src];
  }
  return src;
}

export function classifyStiffness2D(dxx: number, dyy: number, dxy: number, neutralThreshold: number): { lambdaMin: number; lambdaMax: number; className: EquilibriumClass; code: 0 | 1 | 2 | 3 } {
  const tr = dxx + dyy;
  const disc = Math.sqrt(Math.max(0, (dxx - dyy) ** 2 + 4 * dxy * dxy));
  const lambdaMin = 0.5 * (tr - disc), lambdaMax = 0.5 * (tr + disc);
  if (Math.min(Math.abs(lambdaMin), Math.abs(lambdaMax)) <= Math.max(0, neutralThreshold)) return { lambdaMin, lambdaMax, className: "NEUTRAL", code: 3 };
  if (lambdaMin > 0 && lambdaMax > 0) return { lambdaMin, lambdaMax, className: "WELL", code: 0 };
  if (lambdaMin < 0 && lambdaMax > 0) return { lambdaMin, lambdaMax, className: "SADDLE", code: 1 };
  if (lambdaMax < 0) return { lambdaMin, lambdaMax, className: "PEAK", code: 2 };
  return { lambdaMin, lambdaMax, className: "NEUTRAL", code: 3 };
}

export const DEFAULT_LIVE_PARAMS: LiveReducedParams = {
  n: 32, L: 24, rho0: 0.35, rhoMax: 1, B: 0.001953, beta: 0.82, gamma4: 1.74, alpha: 0.01,
  actionLambda: 0.30, kappaScale: 0.08, scatter: 1, angularDirections: 8, actionRelaxIterations: 2,
  actionRelaxation: 0.38, dt: 0.04, densityNoise: 0.012, motionNoise: 0.00015, seed: 8,
};

export class LiveReducedSubstrate2D {
  params: LiveReducedParams;
  readonly rho: Float64Array;
  readonly w: Float64Array;
  readonly mu: Float64Array;
  private readonly k2: Float64Array;
  private readonly omega2: Float64Array;
  private readonly dealias: Uint8Array;
  private readonly actionP: Float64Array[];
  private readonly actionDirs: Array<readonly [number, number]>;
  private initialAmount = 0;
  private up0: number;
  time = 0;
  steps = 0;
  actionResidual = 0;
  stoppedReason: string | null = null;

  constructor(params: Partial<LiveReducedParams> = {}) {
    this.params = { ...DEFAULT_LIVE_PARAMS, ...params };
    if (!isPowerOfTwo(this.params.n)) throw new Error("Live runtime n must be a power of two");
    const size = this.params.n * this.params.n;
    this.rho = new Float64Array(size); this.w = new Float64Array(size); this.mu = new Float64Array(size);
    this.k2 = new Float64Array(size); this.omega2 = new Float64Array(size); this.dealias = new Uint8Array(size);
    this.actionDirs = this.params.angularDirections === 4 ? [[1,0],[0,1],[-1,0],[0,-1]] : Array.from({length:8},(_,i)=>{const a=2*Math.PI*i/8; return [Math.cos(a),Math.sin(a)] as const;});
    this.actionP = this.actionDirs.map(() => new Float64Array(size).fill(1));
    this.up0 = this.uprimeRaw(this.params.rho0);
    this.rebuildSpectrum();
    this.reset(this.params.seed);
  }

  private rebuildSpectrum(): void {
    const {n,L,rho0,rhoMax,B,beta,gamma4,alpha}=this.params;
    const q0=rho0/rhoMax;
    const barrierSecond=(2*B/(rhoMax*rhoMax))*(1/q0**3+1/(1-q0)**3);
    for(let y=0;y<n;y+=1){const my=y<=n/2?y:y-n, ky=2*Math.PI*my/L; for(let x=0;x<n;x+=1){const mx=x<=n/2?x:x-n,kx=2*Math.PI*mx/L,i=y*n+x,k2=kx*kx+ky*ky; this.k2[i]=k2; this.dealias[i]=Math.abs(mx)<=n/3&&Math.abs(my)<=n/3?1:0; this.omega2[i]=k2===0?0:barrierSecond*k2-beta*k2*k2+gamma4*k2**3+alpha;}}
  }

  updateParams(next: Partial<LiveReducedParams>, reset=true): void {
    if(next.n!==undefined&&next.n!==this.params.n) throw new Error("Grid-size changes require constructing a new live runtime");
    this.params={...this.params,...next}; this.up0=this.uprimeRaw(this.params.rho0); this.rebuildSpectrum(); if(reset)this.reset(this.params.seed);
  }

  reset(seed=this.params.seed): void {
    this.params.seed=seed; const {n,rho0,densityNoise,motionNoise}=this.params; const random=makeRandom(seed);
    const noise=new Float64Array(n*n), velocityNoise=new Float64Array(n*n); for(let i=0;i<noise.length;i+=1){noise[i]=random();velocityNoise[i]=random();}
    const smooth=smoothPeriodic(noise,n,5), smoothV=smoothPeriodic(velocityNoise,n,7);
    let m=0,v=0,mv=0,vv=0; for(const q of smooth)m+=q; m/=smooth.length; for(const q of smooth)v+=(q-m)**2; const std=Math.sqrt(v/smooth.length)||1;
    for(const q of smoothV)mv+=q; mv/=smoothV.length; for(const q of smoothV)vv+=(q-mv)**2; const stdv=Math.sqrt(vv/smoothV.length)||1;
    for(let i=0;i<this.rho.length;i+=1){this.rho[i]=rho0+densityNoise*(smooth[i]!-m)/std; this.w[i]=motionNoise*(smoothV[i]!-mv)/stdv;}
    this.projectMean(this.rho,rho0); this.projectMean(this.w,0); for(const P of this.actionP)P.fill(1);
    this.time=0; this.steps=0; this.actionResidual=0; this.stoppedReason=null; this.initialAmount=this.mean(this.rho); this.updateActionStress(); this.computeTotalMu();
  }

  perturb(gridX:number,gridY:number,amplitude:number,radiusCells:number,velocity=false):void{
    const n=this.params.n,target=velocity?this.w:this.rho,beforeMean=this.mean(target);
    for(let y=0;y<n;y+=1){const dy=Math.min(Math.abs(y-gridY),n-Math.abs(y-gridY)); for(let x=0;x<n;x+=1){const dx=Math.min(Math.abs(x-gridX),n-Math.abs(x-gridX)),i=y*n+x; target[i]=target[i]!+amplitude*Math.exp(-0.5*(dx*dx+dy*dy)/Math.max(radiusCells*radiusCells,1e-6));}}
    this.projectMean(target,beforeMean); if(!velocity){const b=this.densityBounds(); if(b.min<=0||b.max>=this.params.rhoMax)this.stoppedReason="PERTURBATION_HIT_DENSITY_BOUND";}
  }

  step(count=1):void{for(let c=0;c<count;c+=1){if(this.stoppedReason)return;this.singleStep();}}
  private singleStep():void{
    const dt=this.params.dt,acc0=this.nonlinearAcceleration(); for(let i=0;i<this.w.length;i+=1)this.w[i]=this.w[i]!+0.5*dt*acc0[i]!;
    this.exactLinearStep(dt); this.projectMean(this.rho,this.params.rho0); this.projectMean(this.w,0); const b=this.densityBounds();
    if(!Number.isFinite(b.min)||!Number.isFinite(b.max)||b.min<=0||b.max>=this.params.rhoMax){this.stoppedReason="DENSITY_BOUND_OR_NONFINITE";return;}
    this.updateActionStress(); const acc1=this.nonlinearAcceleration(); for(let i=0;i<this.w.length;i+=1)this.w[i]=this.w[i]!+0.5*dt*acc1[i]!; this.projectMean(this.w,0); this.computeTotalMu(); this.time+=dt; this.steps+=1;
  }

  private projectMean(values:Float64Array,meanValue:number):void{const h=fft2Real(values,this.params.n); for(let i=0;i<h.re.length;i+=1)if(!this.dealias[i]){h.re[i]=0;h.im[i]=0;} h.re[0]=meanValue*values.length;h.im[0]=0;values.set(ifft2(h,this.params.n));}
  private uprimeRaw(rho:number):number{const q=clamp(rho/this.params.rhoMax,1e-10,1-1e-10);return this.params.B/this.params.rhoMax*(-1/(q*q)+1/((1-q)*(1-q)));}

  private materialMu():Float64Array{
    const n=this.params.n,h=fft2Real(this.rho,n),lapH:{re:Float64Array;im:Float64Array}={re:new Float64Array(h.re.length),im:new Float64Array(h.im.length)},lap2H:{re:Float64Array;im:Float64Array}={re:new Float64Array(h.re.length),im:new Float64Array(h.im.length)},psiH:{re:Float64Array;im:Float64Array}={re:new Float64Array(h.re.length),im:new Float64Array(h.im.length)};
    for(let i=0;i<h.re.length;i+=1){const k2=this.k2[i]!,active=this.dealias[i]?1:0;lapH.re[i]=active*(-k2)*h.re[i]!;lapH.im[i]=active*(-k2)*h.im[i]!;lap2H.re[i]=active*k2*k2*h.re[i]!;lap2H.im[i]=active*k2*k2*h.im[i]!;if(k2>0&&active){psiH.re[i]=h.re[i]!/k2;psiH.im[i]=h.im[i]!/k2;}}
    const lap=ifft2(lapH,n),lap2=ifft2(lap2H,n),psi=ifft2(psiH,n),out=new Float64Array(this.rho.length); for(let i=0;i<out.length;i+=1)out[i]=this.uprimeRaw(this.rho[i]!)-this.up0+this.params.beta*lap[i]!+this.params.gamma4*lap2[i]!+this.params.alpha*psi[i]!; return out;
  }

  private laplacian(values:Float64Array):Float64Array{const h=fft2Real(values,this.params.n);for(let i=0;i<h.re.length;i+=1){const mult=this.dealias[i]?-this.k2[i]!:0;h.re[i]=h.re[i]!*mult;h.im[i]=h.im[i]!*mult;}return ifft2(h,this.params.n);}
  private linearAcceleration(q:Float64Array):Float64Array{const h=fft2Real(q,this.params.n);for(let i=0;i<h.re.length;i+=1){const mult=this.dealias[i]?-this.omega2[i]!:0;h.re[i]=h.re[i]!*mult;h.im[i]=h.im[i]!*mult;}return ifft2(h,this.params.n);}
  private nonlinearAcceleration():Float64Array{this.computeTotalMu();const full=this.laplacian(this.mu),q=new Float64Array(this.rho.length);for(let i=0;i<q.length;i+=1)q[i]=this.rho[i]!-this.params.rho0;const linear=this.linearAcceleration(q);for(let i=0;i<full.length;i+=1)full[i]=full[i]!-linear[i]!;return full;}

  private exactLinearStep(dt:number):void{
    const n=this.params.n,q=new Float64Array(this.rho.length);for(let i=0;i<q.length;i+=1)q[i]=this.rho[i]!-this.params.rho0;const qh=fft2Real(q,n),wh=fft2Real(this.w,n);
    for(let i=0;i<qh.re.length;i+=1){if(!this.dealias[i]){qh.re[i]=qh.im[i]=wh.re[i]=wh.im[i]=0;continue;}const om2=this.omega2[i]!,qr=qh.re[i]!,qi=qh.im[i]!,vr=wh.re[i]!,vi=wh.im[i]!;if(om2>1e-14){const om=Math.sqrt(om2),c=Math.cos(om*dt),s=Math.sin(om*dt);qh.re[i]=qr*c+vr*s/om;qh.im[i]=qi*c+vi*s/om;wh.re[i]=vr*c-qr*om*s;wh.im[i]=vi*c-qi*om*s;}else if(om2<-1e-14){const om=Math.sqrt(-om2),z=Math.min(om*dt,30),c=Math.cosh(z),s=Math.sinh(z);qh.re[i]=qr*c+vr*s/om;qh.im[i]=qi*c+vi*s/om;wh.re[i]=vr*c+qr*om*s;wh.im[i]=vi*c+qi*om*s;}else{qh.re[i]=qr+dt*vr;qh.im[i]=qi+dt*vi;}}
    const qNew=ifft2(qh,n);this.w.set(ifft2(wh,n));for(let i=0;i<this.rho.length;i+=1)this.rho[i]=this.params.rho0+qNew[i]!;
  }

  private derivative(values:Float64Array,dir:readonly[number,number]):Float64Array{const {n,L}=this.params,dx=L/n,out=new Float64Array(values.length),index=(x:number,y:number)=>((y+n)%n)*n+((x+n)%n),sx=dir[0]/(2*dx),sy=dir[1]/(2*dx);for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1)out[y*n+x]=sx*(values[index(x+1,y)]!-values[index(x-1,y)]!)+sy*(values[index(x,y+1)]!-values[index(x,y-1)]!);return out;}
  private kappa(rho:number):number{const q=clamp(rho/this.params.rhoMax,1e-7,1-1e-7);return this.params.kappaScale*q/(1-q);}
  private dkappa(rho:number):number{const q=clamp(rho/this.params.rhoMax,1e-7,1-1e-7);return this.params.kappaScale/this.params.rhoMax/((1-q)*(1-q));}

  private updateActionStress():void{
    if(this.params.actionLambda===0||this.params.actionRelaxIterations<=0){this.actionResidual=0;return;}const size=this.rho.length,kap=new Float64Array(size),a=new Float64Array(size),sig=new Float64Array(size),kbg=this.kappa(this.params.rho0);for(let i=0;i<size;i+=1){kap[i]=this.kappa(this.rho[i]!);a[i]=1/kap[i]!;sig[i]=this.params.scatter*kap[i]!;}
    const J=new Float64Array(size),residual=new Float64Array(size),dx=this.params.L/this.params.n;let lastNorm=0;
    for(let iter=0;iter<this.params.actionRelaxIterations;iter+=1){J.fill(0);for(const P of this.actionP)for(let i=0;i<size;i+=1)J[i]=J[i]!+P[i]!/this.actionP.length;let norm2=0,base2=0;for(let j=0;j<this.actionP.length;j+=1){const P=this.actionP[j]!,dp=this.derivative(P,this.actionDirs[j]!),flux=new Float64Array(size);for(let i=0;i<size;i+=1)flux[i]=a[i]!*dp[i]!;const dflux=this.derivative(flux,this.actionDirs[j]!);for(let i=0;i<size;i+=1){const lhs=-dflux[i]!+kap[i]!*P[i]!+sig[i]!*(P[i]!-J[i]!),r=kbg-lhs;residual[i]=r;norm2+=r*r;base2+=kbg*kbg;}for(let i=0;i<size;i+=1){const diag=2*a[i]!/(dx*dx)+kap[i]!+sig[i]!+1e-9;P[i]=P[i]!+this.params.actionRelaxation*residual[i]!/diag;}}lastNorm=Math.sqrt(norm2/Math.max(base2,1e-30));}this.actionResidual=lastNorm;
  }

  private actionMu():Float64Array{const size=this.rho.length,out=new Float64Array(size);if(this.params.actionLambda===0)return out;const J=new Float64Array(size);for(const P of this.actionP)for(let i=0;i<size;i+=1)J[i]=J[i]!+P[i]!/this.actionP.length;const g2=new Float64Array(size),p2=new Float64Array(size),d2=new Float64Array(size);for(let j=0;j<this.actionP.length;j+=1){const P=this.actionP[j]!,dp=this.derivative(P,this.actionDirs[j]!);for(let i=0;i<size;i+=1){g2[i]=g2[i]!+dp[i]!*dp[i]!/this.actionP.length;p2[i]=p2[i]!+P[i]!*P[i]!/this.actionP.length;const d=P[i]!-J[i]!;d2[i]=d2[i]!+d*d/this.actionP.length;}}for(let i=0;i<size;i+=1){const kap=this.kappa(this.rho[i]!),dkap=this.dkappa(this.rho[i]!),da=-dkap/(kap*kap),dsig=this.params.scatter*dkap;out[i]=0.5*da*g2[i]!+0.5*dkap*p2[i]!+0.5*dsig*d2[i]!;}return out;}

  computeTotalMu():void{const material=this.materialMu(),action=this.actionMu();for(let i=0;i<this.mu.length;i+=1)this.mu[i]=material[i]!-this.params.actionLambda*action[i]!;}
  sourceForce():{fx:Float64Array;fy:Float64Array}{const n=this.params.n,dx=this.params.L/n,fx=new Float64Array(this.mu.length),fy=new Float64Array(this.mu.length),index=(x:number,y:number)=>((y+n)%n)*n+((x+n)%n);for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){const i=y*n+x;fx[i]=-(this.mu[index(x+1,y)]!-this.mu[index(x-1,y)]!)/(2*dx);fy[i]=-(this.mu[index(x,y+1)]!-this.mu[index(x,y-1)]!)/(2*dx);}return{fx,fy};}

  equilibriumMap(neutralFraction=0.08,markerForceFraction=0.08):EquilibriumMap{
    this.computeTotalMu();const {fx,fy}=this.sourceForce(),n=this.params.n,dx=this.params.L/n,lambdaMin=new Float64Array(this.mu.length),lambdaMax=new Float64Array(this.mu.length),classes=new Uint8Array(this.mu.length),forceMag=new Float64Array(this.mu.length),index=(x:number,y:number)=>((y+n)%n)*n+((x+n)%n);let maxForce=0,maxStiffness=0;
    for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){const i=y*n+x,m=this.mu[i]!,dxx=(this.mu[index(x+1,y)]!-2*m+this.mu[index(x-1,y)]!)/(dx*dx),dyy=(this.mu[index(x,y+1)]!-2*m+this.mu[index(x,y-1)]!)/(dx*dx),dxy=(this.mu[index(x+1,y+1)]!-this.mu[index(x+1,y-1)]!-this.mu[index(x-1,y+1)]!+this.mu[index(x-1,y-1)]!)/(4*dx*dx),classified=classifyStiffness2D(dxx,dyy,dxy,0),lo=classified.lambdaMin,hi=classified.lambdaMax;lambdaMin[i]=lo;lambdaMax[i]=hi;maxStiffness=Math.max(maxStiffness,Math.abs(lo),Math.abs(hi));const fm=Math.hypot(fx[i]!,fy[i]!);forceMag[i]=fm;maxForce=Math.max(maxForce,fm);}
    const neutralThreshold=neutralFraction*Math.max(maxStiffness,1e-30);for(let i=0;i<classes.length;i+=1){const lo=lambdaMin[i]!,hi=lambdaMax[i]!;if(Math.min(Math.abs(lo),Math.abs(hi))<=neutralThreshold)classes[i]=3;else if(lo>0&&hi>0)classes[i]=0;else if(lo<0&&hi>0)classes[i]=1;else if(hi<0)classes[i]=2;else classes[i]=3;}
    const markers:EquilibriumMap["markers"]=[],markerThreshold=markerForceFraction*Math.max(maxForce,1e-30);for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){const i=y*n+x;if(forceMag[i]!>markerThreshold)continue;let localMin=true;for(let oy=-1;oy<=1&&localMin;oy+=1)for(let ox=-1;ox<=1;ox+=1){if(ox===0&&oy===0)continue;if(forceMag[index(x+ox,y+oy)]!<forceMag[i]!){localMin=false;break;}}if(!localMin)continue;const code=classes[i]!,className:EquilibriumClass=code===0?"WELL":code===1?"SADDLE":code===2?"PEAK":"NEUTRAL";markers.push({x:(x+0.5)*this.params.L/n,y:(y+0.5)*this.params.L/n,fx:fx[i]!,fy:fy[i]!,lambdaMin:lambdaMin[i]!,lambdaMax:lambdaMax[i]!,className});}
    return{fx,fy,lambdaMin,lambdaMax,classes,markers,forceScale:maxForce,stiffnessScale:maxStiffness};
  }

  metrics(map?:EquilibriumMap):LiveMetrics{const b=this.densityBounds(),eq=map??this.equilibriumMap();let wellCells=0,saddleCells=0,peakCells=0,neutralCells=0;for(const code of eq.classes){if(code===0)wellCells+=1;else if(code===1)saddleCells+=1;else if(code===2)peakCells+=1;else neutralCells+=1;}return{time:this.time,steps:this.steps,rhoMin:b.min,rhoMax:b.max,rhoMean:this.mean(this.rho),amountDrift:this.mean(this.rho)-this.initialAmount,actionResidual:this.actionResidual,wellCells,saddleCells,peakCells,neutralCells,equilibriumCount:eq.markers.length,stoppedReason:this.stoppedReason};}
  private densityBounds():{min:number;max:number}{let min=Infinity,max=-Infinity;for(const v of this.rho){min=Math.min(min,v);max=Math.max(max,v);}return{min,max};}
  private mean(values:Float64Array):number{let sum=0;for(const v of values)sum+=v;return sum/values.length;}
}
