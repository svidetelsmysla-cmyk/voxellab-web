function setText(selector: string, value: string): void {
  const node = document.querySelector<HTMLElement>(selector);
  if (node) node.textContent = value;
}

function relabelActionTallyControls(): void {
  const select = document.querySelector<HTMLSelectElement>("#action-tally-branch");
  if (!select) return;
  const labels: Record<string, string> = {
    H0_HOMOGENIZED: "H0 SYNTHETIC COMMON-PACKET FIXTURE",
    R0_FORWARD_PRESERVING: "R0 FORWARD ZERO CONTROL",
    R1_ISOTROPIC_REDIRECTION: "R1 INDEX-REMAP CONTROL (legacy label)",
    R2_SPECULAR_REDIRECTION: "R2 SPECULAR NUMERICAL CONTROL",
    R3_SOURCE_COMPATIBLE_CANDIDATE: "R3 FIXED-ROTATION PLACEHOLDER",
  };
  for (const option of Array.from(select.options)) {
    option.textContent = labels[option.value] ?? option.textContent;
  }
}

function appendStatusCard(): void {
  const section = document.querySelector<HTMLElement>(".matched-residual-section");
  if (!section || section.querySelector("#relational-time-status")) return;
  const note = document.createElement("div");
  note.id = "relational-time-status";
  note.className = "claim-note action-tally-firewall";
  note.dataset.testid = "relational-time-status";
  note.innerHTML = [
    "<strong>RELATIONAL-TIME SCOPE</strong>",
    "Dimensionless resultant and torque are available per one common incident packet / comparison cycle.",
    "Physical seconds and SI force units are deferred until a recognizable cyclic structure and scale exist.",
    "The current MR gates are not blocked by cadence; no routing law or validation is selected.",
  ].join(" · ");
  section.querySelector(".panel-heading")?.after(note);
}

export function mountRelationalTimeUiRepair(): void {
  relabelActionTallyControls();
  appendStatusCard();
  setText(
    ".action-tally-card .action-tally-firewall",
    "PATH DEPTH = geometry/topology only · cell action already contains ΔΩ · dimensionless resultant available per common relational cycle · SI time/force units deferred.",
  );
  setText(
    ".matched-residual-section .matched-intro",
    "MR00–MR07 are the scene-faithful G4 V2 controls with eight unique scene signatures. DL00–DL07 remain legacy diagnostics and are not replayed on the current ActionTally.",
  );
  const matchedNotes = document.querySelectorAll<HTMLElement>(
    ".matched-residual-section .action-tally-firewall",
  );
  const legacyNote = matchedNotes.item(matchedNotes.length - 1);
  if (legacyNote) {
    legacyNote.textContent =
      "Standard-null status, current dimensionless residual, scene fidelity and SI-unit binding are separate fields. No SI conversion is performed; this does not block dimensionless sign/null/convergence tests.";
  }
}
