import {
  DEFAULT_LIVE_PARAMS,
  LiveReducedSubstrate2D,
  type DisplayField,
  type EquilibriumMap,
  type LiveReducedParams,
} from "./liveReducedSubstrate";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";
type PerturbMode = "DENSITY_PLUS" | "DENSITY_MINUS" | "CURRENT_PLUS";

function format(value: number, digits = 5): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e4) return value.toExponential(3);
  return value.toFixed(digits);
}
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function rgba(code: number, strength: number): string {
  const a = 0.18 + 0.82 * clamp01(strength);
  if (code === 0) return `rgba(42,132,214,${a})`;
  if (code === 1) return `rgba(221,126,53,${a})`;
  if (code === 2) return `rgba(193,64,72,${a})`;
  return `rgba(133,151,154,${0.12 + 0.55 * clamp01(strength)})`;
}
function heat(value: number): string {
  const t = clamp01(value), r = Math.round(18 + 70 * t), g = Math.round(41 + 180 * t), b = Math.round(55 + 145 * t);
  return `rgb(${r},${g},${b})`;
}
function diverging(value: number): string {
  const t = clamp01(0.5 + 0.5 * value);
  if (t < 0.5) { const u = t / 0.5; return `rgb(${Math.round(22 + 90*u)},${Math.round(52 + 115*u)},${Math.round(105 + 85*u)})`; }
  const u = (t - 0.5) / 0.5; return `rgb(${Math.round(112 + 125*u)},${Math.round(167 - 80*u)},${Math.round(190 - 125*u)})`;
}

export class LiveEquilibriumRuntimePanel {
  private runtime: LiveReducedSubstrate2D;
  private running = false;
  private speed = 1;
  private displayField: DisplayField = "EQUILIBRIUM";
  private showArrows = true;
  private showMarkers = true;
  private showDensityOverlay = false;
  private neutralFraction = 0.08;
  private markerForceFraction = 0.055;
  private perturbMode: PerturbMode = "DENSITY_PLUS";
  private perturbAmplitude = 0.006;
  private perturbRadius = 2.5;
  private lastFrameTime = 0;
  private frames = 0;
  private measuredFps = 0;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private message = "Live runtime ready.";

  constructor(private readonly root: HTMLElement) {
    this.runtime = new LiveReducedSubstrate2D(DEFAULT_LIVE_PARAMS);
    this.mount();
    this.renderFrame();
    requestAnimationFrame((time) => this.loop(time));
  }

  private mount(): void {
    this.root.innerHTML = `<section class="a5-panel" data-testid="a5-live-equilibrium-runtime">
      <header class="a5-header">
        <div>
          <p class="a5-kicker">Action Transport Lab · A5</p>
          <h2>Live equilibrium runtime</h2>
          <p>Настоящий browser-runtime: <code>ρ</code> и продольное состояние пересчитываются сейчас, а карта <strong>ям / сёдел / безразличия</strong> строится из текущего driving readout <code>F = -∇μ</code> того же шага. Никаких записанных кадров.</p>
        </div>
        <div class="a5-status"><span>LIVE 2D REDUCED RUNTIME</span><strong>EXPLORATORY · NOT 3D V14H VALIDATION</strong></div>
      </header>
      <div class="a5-callout"><strong>Зачем этот режим</strong><span>Он показывает изменение силовой топологии раньше отклика плотности. Полный 3D V14H/GCROT остаётся high-fidelity gate; здесь нужен быстрый интерактивный лабораторный режим, как прежний wave solver.</span></div>
      <div class="a5-workspace">
        <aside class="a5-controls">
          <div class="a5-control-section"><h3>Запуск</h3><div class="a5-buttons"><button id="a5-play" type="button">▶ PLAY</button><button id="a5-step" type="button">STEP</button><button id="a5-reset" type="button">RESET</button><button id="a5-new-seed" type="button">NEW SEED</button></div><label>Скорость<select id="a5-speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label></div>
          <div class="a5-control-section"><h3>Параметры механики</h3>
            <label>Grid<select id="a5-grid"><option value="32">32² · fast</option><option value="64">64² · fine</option></select></label>
            <label>ρ₀ <input id="a5-rho0" type="number" min="0.1" max="0.7" step="0.01" value="${DEFAULT_LIVE_PARAMS.rho0}"></label>
            <label>Δt <input id="a5-dt" type="number" min="0.002" max="0.08" step="0.002" value="${DEFAULT_LIVE_PARAMS.dt}"></label>
            <label>B <input id="a5-B" type="number" step="0.0001" value="${DEFAULT_LIVE_PARAMS.B}"></label>
            <label>β <input id="a5-beta" type="number" step="0.02" value="${DEFAULT_LIVE_PARAMS.beta}"></label>
            <label>γ₄ <input id="a5-gamma4" type="number" step="0.02" value="${DEFAULT_LIVE_PARAMS.gamma4}"></label>
            <label>α <input id="a5-alpha" type="number" step="0.002" value="${DEFAULT_LIVE_PARAMS.alpha}"></label>
            <label>action λ <input id="a5-action" type="number" min="0" max="1" step="0.05" value="${DEFAULT_LIVE_PARAMS.actionLambda}"></label>
            <label>κ scale <input id="a5-kappa" type="number" min="0.005" max="0.3" step="0.005" value="${DEFAULT_LIVE_PARAMS.kappaScale}"></label>
            <label>scatter <input id="a5-scatter" type="number" min="0" max="4" step="0.1" value="${DEFAULT_LIVE_PARAMS.scatter}"></label>
            <label>Angular dirs<select id="a5-dirs"><option value="4">4</option><option value="8" selected>8</option></select></label>
            <label>Stress relax iters <input id="a5-relax-iters" type="number" min="0" max="8" step="1" value="${DEFAULT_LIVE_PARAMS.actionRelaxIterations}"></label>
            <label>Initial density noise <input id="a5-noise" type="number" min="0.001" max="0.05" step="0.001" value="${DEFAULT_LIVE_PARAMS.densityNoise}"></label>
            <button id="a5-apply" type="button" class="a5-primary">APPLY + RESET</button>
          </div>
          <div class="a5-control-section"><h3>Карта равновесий</h3>
            <label>Режим<select id="a5-display"><option value="EQUILIBRIUM">Equilibrium classes</option><option value="DENSITY">Density ρ</option><option value="MU">μ</option><option value="FORCE">|−∇μ|</option></select></label>
            <label>Neutral threshold <input id="a5-neutral" type="range" min="0.01" max="0.25" step="0.01" value="0.08"></label>
            <label>Zero-force threshold <input id="a5-zero" type="range" min="0.01" max="0.20" step="0.005" value="0.055"></label>
            <label class="a5-check"><input id="a5-arrows" type="checkbox" checked> force arrows</label><label class="a5-check"><input id="a5-markers" type="checkbox" checked> equilibrium markers</label><label class="a5-check"><input id="a5-density-overlay" type="checkbox"> density overlay</label>
          </div>
          <div class="a5-control-section"><h3>Возмущение мышью</h3>
            <label>Тип<select id="a5-perturb-mode"><option value="DENSITY_PLUS">+ρ</option><option value="DENSITY_MINUS">−ρ</option><option value="CURRENT_PLUS">radial/current scalar impulse</option></select></label>
            <label>Amplitude <input id="a5-perturb-amp" type="number" step="0.001" value="0.006"></label><label>Radius cells <input id="a5-perturb-radius" type="number" min="0.5" max="8" step="0.5" value="2.5"></label><p>Click the map to perturb. This is a diagnostic experiment, not source evidence.</p>
          </div>
        </aside>
        <main class="a5-main">
          <div class="a5-canvas-wrap"><canvas id="a5-canvas" width="760" height="760" aria-label="Live equilibrium solver map"></canvas><div class="a5-legend"><span><i class="well"></i>ЯМА</span><span><i class="saddle"></i>СЕДЛО</span><span><i class="peak"></i>ПИК</span><span><i class="neutral"></i>БЕЗРАЗЛИЧИЕ</span></div></div>
          <div class="a5-metrics" aria-live="polite"><div><span>t</span><strong id="a5-m-time"></strong></div><div><span>steps</span><strong id="a5-m-steps"></strong></div><div><span>ρ min/max</span><strong id="a5-m-rho"></strong></div><div><span>mean drift</span><strong id="a5-m-drift"></strong></div><div><span>action residual</span><strong id="a5-m-action"></strong></div><div><span>equilibria</span><strong id="a5-m-eq"></strong></div><div><span>runtime FPS</span><strong id="a5-m-fps"></strong></div><div><span>status</span><strong id="a5-m-status"></strong></div></div>
          <div class="a5-class-counts"><span id="a5-count-well"></span><span id="a5-count-saddle"></span><span id="a5-count-peak"></span><span id="a5-count-neutral"></span></div><p id="a5-message" class="a5-message">${this.message}</p>
        </main>
      </div>
      <footer class="a5-footer"><code>ρ_tt = Δ(μ_material − λ μ_action)</code><span>periodic reduced 2D runtime · exact spectral linear step · live quasi-static angular-stress relaxation · source equilibrium map from current −∇μ</span><small>commit ${APP_COMMIT.slice(0,12)}</small></footer>
    </section>`;
    const canvas=this.root.querySelector<HTMLCanvasElement>("#a5-canvas"),context=canvas?.getContext("2d");if(!canvas||!context)throw new Error("A5 live canvas unavailable");this.canvas=canvas;this.context=context;this.bind();
  }

  private bind(): void {
    this.root.querySelector<HTMLButtonElement>("#a5-play")?.addEventListener("click",()=>{this.running=!this.running;this.updatePlayButton();});
    this.root.querySelector<HTMLButtonElement>("#a5-step")?.addEventListener("click",()=>{this.runtime.step(1);this.renderFrame();});
    this.root.querySelector<HTMLButtonElement>("#a5-reset")?.addEventListener("click",()=>{this.runtime.reset(this.runtime.params.seed);this.message="State reset from the current seed.";this.renderFrame();});
    this.root.querySelector<HTMLButtonElement>("#a5-new-seed")?.addEventListener("click",()=>{const seed=(this.runtime.params.seed+1+Math.floor(Math.random()*997))|0;this.runtime.reset(seed);this.message=`New continuous fluctuation seed: ${seed}`;this.renderFrame();});
    this.root.querySelector<HTMLSelectElement>("#a5-speed")?.addEventListener("change",e=>{this.speed=Number((e.target as HTMLSelectElement).value);});
    this.root.querySelector<HTMLSelectElement>("#a5-display")?.addEventListener("change",e=>{this.displayField=(e.target as HTMLSelectElement).value as DisplayField;this.renderFrame();});
    this.root.querySelector<HTMLInputElement>("#a5-neutral")?.addEventListener("input",e=>{this.neutralFraction=Number((e.target as HTMLInputElement).value);this.renderFrame();});
    this.root.querySelector<HTMLInputElement>("#a5-zero")?.addEventListener("input",e=>{this.markerForceFraction=Number((e.target as HTMLInputElement).value);this.renderFrame();});
    this.root.querySelector<HTMLInputElement>("#a5-arrows")?.addEventListener("change",e=>{this.showArrows=(e.target as HTMLInputElement).checked;this.renderFrame();});
    this.root.querySelector<HTMLInputElement>("#a5-markers")?.addEventListener("change",e=>{this.showMarkers=(e.target as HTMLInputElement).checked;this.renderFrame();});
    this.root.querySelector<HTMLInputElement>("#a5-density-overlay")?.addEventListener("change",e=>{this.showDensityOverlay=(e.target as HTMLInputElement).checked;this.renderFrame();});
    this.root.querySelector<HTMLSelectElement>("#a5-perturb-mode")?.addEventListener("change",e=>{this.perturbMode=(e.target as HTMLSelectElement).value as PerturbMode;});
    this.root.querySelector<HTMLInputElement>("#a5-perturb-amp")?.addEventListener("change",e=>{this.perturbAmplitude=Number((e.target as HTMLInputElement).value);});
    this.root.querySelector<HTMLInputElement>("#a5-perturb-radius")?.addEventListener("change",e=>{this.perturbRadius=Number((e.target as HTMLInputElement).value);});
    this.root.querySelector<HTMLButtonElement>("#a5-apply")?.addEventListener("click",()=>this.applyParams());this.canvas.addEventListener("click",e=>this.perturbFromCanvas(e));
  }
  private inputNumber(id:string):number{return Number(this.root.querySelector<HTMLInputElement>(id)?.value);}
  private applyParams():void{
    const n=Number(this.root.querySelector<HTMLSelectElement>("#a5-grid")?.value) as 32|64;
    const next:Partial<LiveReducedParams>={n,rho0:this.inputNumber("#a5-rho0"),dt:this.inputNumber("#a5-dt"),B:this.inputNumber("#a5-B"),beta:this.inputNumber("#a5-beta"),gamma4:this.inputNumber("#a5-gamma4"),alpha:this.inputNumber("#a5-alpha"),actionLambda:this.inputNumber("#a5-action"),kappaScale:this.inputNumber("#a5-kappa"),scatter:this.inputNumber("#a5-scatter"),angularDirections:Number(this.root.querySelector<HTMLSelectElement>("#a5-dirs")?.value) as 4|8,actionRelaxIterations:Math.round(this.inputNumber("#a5-relax-iters")),densityNoise:this.inputNumber("#a5-noise")};
    try{if(n!==this.runtime.params.n||next.angularDirections!==this.runtime.params.angularDirections)this.runtime=new LiveReducedSubstrate2D({...this.runtime.params,...next});else this.runtime.updateParams(next,true);this.running=false;this.updatePlayButton();this.message=`Applied live parameters and reset. Grid ${n}².`;}catch(error){this.message=String(error);}this.renderFrame();
  }
  private perturbFromCanvas(event:MouseEvent):void{const rect=this.canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)/rect.width*this.runtime.params.n),y=Math.floor((event.clientY-rect.top)/rect.height*this.runtime.params.n),sign=this.perturbMode==="DENSITY_MINUS"?-1:1;this.runtime.perturb(x,y,sign*this.perturbAmplitude,this.perturbRadius,this.perturbMode==="CURRENT_PLUS");this.message=`Applied ${this.perturbMode} at grid (${x}, ${y}).`;this.renderFrame();}
  private updatePlayButton():void{const button=this.root.querySelector<HTMLButtonElement>("#a5-play");if(button)button.textContent=this.running?"⏸ PAUSE":"▶ PLAY";}
  private loop(time:number):void{if(this.running&&!this.runtime.stoppedReason){this.runtime.step(this.speed);this.renderFrame();}this.frames+=1;if(!this.lastFrameTime)this.lastFrameTime=time;if(time-this.lastFrameTime>500){this.measuredFps=this.frames*1000/(time-this.lastFrameTime);this.frames=0;this.lastFrameTime=time;this.updateMetricsOnly();}requestAnimationFrame(next=>this.loop(next));}
  private renderFrame():void{const map=this.runtime.equilibriumMap(this.neutralFraction,this.markerForceFraction);if(this.displayField==="EQUILIBRIUM")this.paintEquilibrium(map);else if(this.displayField==="DENSITY")this.paintDensity();else if(this.displayField==="MU")this.paintMu();else this.paintForce(map);if(this.showArrows)this.paintArrows(map);if(this.showMarkers)this.paintMarkers(map);this.updateMetricsOnly(map);}
  private paintEquilibrium(map:EquilibriumMap):void{const{n}=this.runtime.params,cellW=this.canvas.width/n,cellH=this.canvas.height/n;this.context.fillStyle="#061015";this.context.fillRect(0,0,this.canvas.width,this.canvas.height);for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){const i=y*n+x,strength=Math.max(Math.abs(map.lambdaMin[i]!),Math.abs(map.lambdaMax[i]!))/Math.max(map.stiffnessScale,1e-30);this.context.fillStyle=rgba(map.classes[i]!,strength);this.context.fillRect(x*cellW,y*cellH,cellW+.5,cellH+.5);}if(this.showDensityOverlay)this.overlayDensity(.24);}
  private paintDensity():void{const{n,rho0,rhoMax}=this.runtime.params,cellW=this.canvas.width/n,cellH=this.canvas.height/n;for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){const rho=this.runtime.rho[y*n+x]!,value=clamp01((rho-.4*rho0)/Math.max(rhoMax-.4*rho0,1e-9));this.context.fillStyle=heat(value);this.context.fillRect(x*cellW,y*cellH,cellW+.5,cellH+.5);}}
  private paintMu():void{const{n}=this.runtime.params,cellW=this.canvas.width/n,cellH=this.canvas.height/n;let scale=0;for(const v of this.runtime.mu)scale=Math.max(scale,Math.abs(v));for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){this.context.fillStyle=diverging(this.runtime.mu[y*n+x]!/Math.max(scale,1e-30));this.context.fillRect(x*cellW,y*cellH,cellW+.5,cellH+.5);}}
  private paintForce(map:EquilibriumMap):void{const{n}=this.runtime.params,cellW=this.canvas.width/n,cellH=this.canvas.height/n;for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){const i=y*n+x,mag=Math.hypot(map.fx[i]!,map.fy[i]!)/Math.max(map.forceScale,1e-30),shade=Math.round(20+210*Math.sqrt(clamp01(mag)));this.context.fillStyle=`rgb(${Math.round(shade*.45)},${Math.round(shade*.8)},${shade})`;this.context.fillRect(x*cellW,y*cellH,cellW+.5,cellH+.5);}}
  private overlayDensity(alpha:number):void{const{n,rho0}=this.runtime.params,cellW=this.canvas.width/n,cellH=this.canvas.height/n;let maxDev=0;for(const rho of this.runtime.rho)maxDev=Math.max(maxDev,Math.abs(rho-rho0));for(let y=0;y<n;y+=1)for(let x=0;x<n;x+=1){const dev=(this.runtime.rho[y*n+x]!-rho0)/Math.max(maxDev,1e-30),a=alpha*Math.abs(dev);this.context.fillStyle=dev>=0?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a})`;this.context.fillRect(x*cellW,y*cellH,cellW+.5,cellH+.5);}}
  private paintArrows(map:EquilibriumMap):void{const{n}=this.runtime.params,stride=n===64?5:3,cellW=this.canvas.width/n,cellH=this.canvas.height/n;this.context.save();this.context.strokeStyle="rgba(240,248,247,.62)";this.context.fillStyle="rgba(240,248,247,.72)";this.context.lineWidth=1;for(let y=0;y<n;y+=stride)for(let x=0;x<n;x+=stride){const i=y*n+x,fx=map.fx[i]!,fy=map.fy[i]!,mag=Math.hypot(fx,fy);if(!(mag>1e-12))continue;const ux=fx/mag,uy=fy/mag,length=5+11*Math.sqrt(clamp01(mag/Math.max(map.forceScale,1e-30))),sx=(x+.5)*cellW,sy=(y+.5)*cellH,ex=sx+ux*length,ey=sy+uy*length;this.context.beginPath();this.context.moveTo(sx,sy);this.context.lineTo(ex,ey);this.context.stroke();const angle=Math.atan2(ey-sy,ex-sx);this.context.beginPath();this.context.moveTo(ex,ey);this.context.lineTo(ex-3.5*Math.cos(angle-.55),ey-3.5*Math.sin(angle-.55));this.context.lineTo(ex-3.5*Math.cos(angle+.55),ey-3.5*Math.sin(angle+.55));this.context.closePath();this.context.fill();}this.context.restore();}
  private paintMarkers(map:EquilibriumMap):void{const L=this.runtime.params.L,sx=this.canvas.width/L,sy=this.canvas.height/L;this.context.save();this.context.font="11px system-ui";this.context.textAlign="center";this.context.textBaseline="middle";for(const marker of map.markers.slice(0,80)){const x=marker.x*sx,y=marker.y*sy,code=marker.className==="WELL"?0:marker.className==="SADDLE"?1:marker.className==="PEAK"?2:3;this.context.fillStyle=rgba(code,1);this.context.strokeStyle="rgba(255,255,255,.85)";this.context.lineWidth=1.25;this.context.beginPath();this.context.arc(x,y,5.5,0,Math.PI*2);this.context.fill();this.context.stroke();this.context.fillStyle="white";this.context.fillText(marker.className==="WELL"?"Я":marker.className==="SADDLE"?"С":marker.className==="PEAK"?"П":"Б",x,y+.3);}this.context.restore();}
  private updateMetricsOnly(map?:EquilibriumMap):void{const currentMap=map??this.runtime.equilibriumMap(this.neutralFraction,this.markerForceFraction),m=this.runtime.metrics(currentMap),set=(id:string,text:string)=>{const el=this.root.querySelector<HTMLElement>(id);if(el)el.textContent=text;};set("#a5-m-time",format(m.time,3));set("#a5-m-steps",String(m.steps));set("#a5-m-rho",`${format(m.rhoMin,4)} / ${format(m.rhoMax,4)}`);set("#a5-m-drift",format(m.amountDrift,3));set("#a5-m-action",format(m.actionResidual,3));set("#a5-m-eq",String(m.equilibriumCount));set("#a5-m-fps",format(this.measuredFps,1));set("#a5-m-status",m.stoppedReason??(this.running?"RUNNING":"PAUSED"));set("#a5-count-well",`ЯМА ${m.wellCells}`);set("#a5-count-saddle",`СЕДЛО ${m.saddleCells}`);set("#a5-count-peak",`ПИК ${m.peakCells}`);set("#a5-count-neutral",`БЕЗРАЗЛИЧИЕ ${m.neutralCells}`);set("#a5-message",this.message);if(m.stoppedReason){this.running=false;this.updatePlayButton();this.message=`Runtime stopped explicitly: ${m.stoppedReason}. Change parameters or reset; no hidden clipping was applied.`;set("#a5-message",this.message);}}
}
