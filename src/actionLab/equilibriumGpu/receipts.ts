import { REGIME_FROM_ID, type PlaneResult } from "./types";

export interface PlaneParityReceipt {
  responseRelativeL2: number;
  meanResponseCosine: number;
  eigenvalueSignAgreement: number;
  classificationAgreement: number;
  comparedPixels: number;
  status: "PASS" | "FAIL";
}

export function comparePlaneResults(cpu: PlaneResult, gpu: PlaneResult): PlaneParityReceipt {
  if (cpu.width !== gpu.width || cpu.height !== gpu.height) throw new Error("Parity dimensions differ");
  let error2 = 0, reference2 = 0, cosineSum = 0, cosineCount = 0;
  let signMatches = 0, signCount = 0, classMatches = 0;
  const count = cpu.width * cpu.height;
  for (let i = 0; i < count; i++) {
    let dot = 0, cn = 0, gn = 0;
    for (let c = 0; c < 3; c++) {
      const cv = cpu.response[i * 4 + c]!, gv = gpu.response[i * 4 + c]!;
      error2 += (gv - cv) ** 2; reference2 += cv * cv;
      dot += cv * gv; cn += cv * cv; gn += gv * gv;
      const ce = cpu.eigenvalues[i * 3 + c]!, ge = gpu.eigenvalues[i * 3 + c]!;
      const neutral = Math.abs(ce) <= 1e-7 || Math.abs(ge) <= 1e-7;
      if (!neutral) { signCount++; if (Math.sign(ce) === Math.sign(ge)) signMatches++; }
    }
    if (cn > 1e-24 && gn > 1e-24) { cosineSum += dot / Math.sqrt(cn * gn); cosineCount++; }
    if (REGIME_FROM_ID[cpu.classes[i]!] === REGIME_FROM_ID[gpu.classes[i]!]) classMatches++;
  }
  const responseRelativeL2 = Math.sqrt(error2 / Math.max(reference2, 1e-30));
  // The frozen t=0 control is identically zero. Empty nonzero/sign sets are a
  // vacuous parity PASS only when the relative L2 error is also zero.
  const meanResponseCosine = cosineCount ? cosineSum / cosineCount : (error2 === 0 && reference2 === 0 ? 1 : 0);
  const eigenvalueSignAgreement = signCount ? signMatches / signCount : 1;
  const classificationAgreement = classMatches / count;
  return {
    responseRelativeL2,
    meanResponseCosine,
    eigenvalueSignAgreement,
    classificationAgreement,
    comparedPixels: count,
    status: responseRelativeL2 <= 0.002 && meanResponseCosine >= 0.999 && eigenvalueSignAgreement >= 0.999 ? "PASS" : "FAIL",
  };
}
