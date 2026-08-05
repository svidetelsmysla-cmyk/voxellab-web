import {
  matchedOutgoingCoefficient,
  matchedUniformSourceDensity,
  normalizedOneBodyClosureSample,
  oneBodyClosureSample,
  totalAcceptedIsotropicAction,
  type ClosureModel,
  type ScalarChannels,
} from "./closure";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing A0.3 element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e4) return value.toExponential(5);
  return value.toFixed(6);
}

function template(): string {
  return `
    <section class="closure-a03 card" data-testid="closure-a03-panel">
      <div class="section-head closure-a03-head">
        <div>
          <p class="eyebrow">A0.3 · ONE-BODY RADIAL CLOSURE</p>
          <h2>Тело-источник и тело-экран: все W на одном радиусе</h2>
          <p class="closure-subtitle">Точный расчёт однородной сферы. Никакого сплайна в зоне тела и никакого придуманного пересечения.</p>
        </div>
        <span class="audit-badge pass" data-testid="closure-a03-status">ANALYTIC CONTRACT</span>
      </div>

      <div class="closure-controls">
        <label>
          Отношение прямого источника к замкнутому фону, κ
          <input id="closure-ratio" type="range" min="0" max="1.6" step="0.05" value="1">
        </label>
        <output id="closure-ratio-value">1.00</output>
        <button id="closure-reset">κ = 1 · замкнутый контроль</button>
        <button id="closure-export">EXPORT A0.3 RECEIPT</button>
      </div>

      <div class="closure-proof-grid">
        <article>
          <strong>Что дано источником Виктора</strong>
          <p>Тело оказывает воздействие пропорционально своему количеству, а воздействие распределяется по сфере как 1/(4πr²). Комплекс остальных тел создаёт базовую напряжённость.</p>
        </article>
        <article>
          <strong>Что добавлено как проверяемое замыкание</strong>
          <p>Полное принятие, стационарность, отсутствие уничтожения/накопления и изотропное перераспределение принятого действия по 4π.</p>
        </article>
        <article>
          <strong>Что строго следует при этих условиях</strong>
          <p>A<sub>in</sub> = 4π²IR²; S<sub>out</sub> = A<sub>in</sub>/4π = πIR². Поэтому прямой W1 и остаток внешнего фона имеют одинаковый модуль 1/r², но противоположные физические направления.</p>
        </article>
      </div>

      <div class="closure-chart-grid">
        <article class="closure-chart-card">
          <div class="section-head"><div><p class="eyebrow">СКАЛЯРНАЯ ЗАГРУЗКА</p><h2>W0: сколько действия присутствует</h2></div><span>нормировка на πI</span></div>
          <canvas id="closure-scalar-chart" width="820" height="410" data-testid="closure-scalar-chart"></canvas>
          <div class="closure-legend">
            <span class="c-body-w0">W0 тела</span>
            <span class="c-incident">фон incident</span>
            <span class="c-surviving">фон surviving</span>
            <span class="c-deficit">фон deficit</span>
          </div>
          <p>W0 не является силой: встречные направления здесь складываются как положительное количество.</p>
        </article>

        <article class="closure-chart-card">
          <div class="section-head"><div><p class="eyebrow">НАПРАВЛЕННЫЙ ОСТАТОК</p><h2>W1: прямой выход, внешний остаток и сумма</h2></div><span>наружу + / к телу −</span></div>
          <canvas id="closure-vector-chart" width="820" height="410" data-testid="closure-vector-chart"></canvas>
          <div class="closure-legend">
            <span class="c-direct">прямой выход тела</span>
            <span class="c-external">остаток внешнего фона</span>
            <span class="c-net">сумма</span>
          </div>
          <p id="closure-direction-verdict"></p>
        </article>
      </div>

      <div class="closure-readout-grid" data-testid="closure-readout">
        <div><span>Принято сферой A<sub>in</sub></span><strong id="closure-accepted"></strong></div>
        <div><span>Согласованный коэффициент S<sub>out</sub></span><strong id="closure-coefficient"></strong></div>
        <div><span>Эквивалентная плотность q</span><strong id="closure-density"></strong></div>
        <div><span>Внешний закон прямой ветви</span><strong id="closure-direct-law"></strong></div>
        <div><span>Внешний закон фоновой ветви</span><strong id="closure-background-law"></strong></div>
        <div><span>Конечная точка пересечения</span><strong id="closure-crossing"></strong></div>
      </div>

      <div class="closure-conclusion" data-testid="closure-conclusion">
        <strong>Граница результата</strong>
        <p id="closure-conclusion-text"></p>
        <small>Фоновые A0.2-ветви определены только для внешней точки r ≥ R. Зона r &lt; R на графике не заполняется выдуманным законом экранирования.</small>
      </div>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

interface ChartGeometry {
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotWidth: number;
  plotHeight: number;
}

export class OneBodyClosurePanel {
  private model: ClosureModel = {
    radius: 1,
    backgroundIntensityPerSteradian: 1,
    sourceToMatchedRatio: 1,
  };

  private readonly scalarCanvas: HTMLCanvasElement;
  private readonly vectorCanvas: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.scalarCanvas = required<HTMLCanvasElement>(root, "#closure-scalar-chart");
    this.vectorCanvas = required<HTMLCanvasElement>(root, "#closure-vector-chart");
    this.bind();
    this.render();
  }

  private bind(): void {
    const ratio = required<HTMLInputElement>(this.root, "#closure-ratio");
    ratio.addEventListener("input", () => {
      this.model = { ...this.model, sourceToMatchedRatio: Number(ratio.value) };
      this.render();
    });
    required<HTMLButtonElement>(this.root, "#closure-reset").addEventListener("click", () => {
      ratio.value = "1";
      this.model = { ...this.model, sourceToMatchedRatio: 1 };
      this.render();
    });
    required<HTMLButtonElement>(this.root, "#closure-export").addEventListener("click", () => this.exportReceipt());
  }

  private geometry(canvas: HTMLCanvasElement): ChartGeometry {
    const left = 62;
    const right = 22;
    const top = 28;
    const bottom = 50;
    return {
      left,
      right,
      top,
      bottom,
      plotWidth: canvas.width - left - right,
      plotHeight: canvas.height - top - bottom,
    };
  }

  private drawAxes(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    yMin: number,
    yMax: number,
    yTicks: number[],
  ): ChartGeometry {
    const geometry = this.geometry(canvas);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(218,235,228,0.72)";
    context.strokeStyle = "rgba(255,255,255,0.13)";
    context.font = "12px ui-monospace, monospace";
    const yOf = (value: number) => geometry.top + (yMax - value) / (yMax - yMin) * geometry.plotHeight;
    for (const tick of yTicks) {
      const y = yOf(tick);
      context.beginPath();
      context.moveTo(geometry.left, y);
      context.lineTo(canvas.width - geometry.right, y);
      context.stroke();
      context.fillText(tick.toFixed(Math.abs(tick) < 1 ? 2 : 1), 8, y + 4);
    }
    for (const ratio of [0, 1, 2, 3, 5, 8]) {
      const x = geometry.left + ratio / 8 * geometry.plotWidth;
      context.beginPath();
      context.moveTo(x, geometry.top);
      context.lineTo(x, canvas.height - geometry.bottom);
      context.stroke();
      context.fillText(`${ratio}R`, x - 12, canvas.height - 20);
    }
    const surfaceX = geometry.left + geometry.plotWidth / 8;
    context.fillStyle = "rgba(232,197,104,0.07)";
    context.fillRect(geometry.left, geometry.top, surfaceX - geometry.left, geometry.plotHeight);
    context.strokeStyle = "rgba(232,197,104,0.85)";
    context.setLineDash([5, 5]);
    context.beginPath();
    context.moveTo(surfaceX, geometry.top);
    context.lineTo(surfaceX, canvas.height - geometry.bottom);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "rgba(232,197,104,0.88)";
    context.fillText("поверхность R", surfaceX + 6, geometry.top + 15);
    return geometry;
  }

  private sampleGrid(): ScalarChannels[] {
    const samples: ScalarChannels[] = [];
    const count = 640;
    for (let index = 0; index <= count; index += 1) {
      const ratio = 8 * index / count;
      samples.push(normalizedOneBodyClosureSample(ratio * this.model.radius, this.model));
    }
    return samples;
  }

  private drawSeries(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    geometry: ChartGeometry,
    samples: ScalarChannels[],
    selector: (sample: ScalarChannels) => number | null,
    yMin: number,
    yMax: number,
    stroke: string,
    width: number,
    dashed = false,
  ): void {
    const xOf = (ratio: number) => geometry.left + ratio / 8 * geometry.plotWidth;
    const yOf = (value: number) => geometry.top + (yMax - value) / (yMax - yMin) * geometry.plotHeight;
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.setLineDash(dashed ? [8, 5] : []);
    context.beginPath();
    let started = false;
    for (const sample of samples) {
      const value = selector(sample);
      if (value === null || !Number.isFinite(value)) {
        started = false;
        continue;
      }
      const x = xOf(sample.radiusRatio);
      const y = yOf(Math.max(yMin, Math.min(yMax, value)));
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
    context.setLineDash([]);
  }

  private render(): void {
    const ratio = this.model.sourceToMatchedRatio;
    required<HTMLOutputElement>(this.root, "#closure-ratio-value").value = ratio.toFixed(2);
    const samples = this.sampleGrid();
    this.renderScalar(samples);
    this.renderVector(samples);

    const accepted = totalAcceptedIsotropicAction(this.model.radius, this.model.backgroundIntensityPerSteradian);
    const coefficient = matchedOutgoingCoefficient(this.model.radius, this.model.backgroundIntensityPerSteradian);
    const density = matchedUniformSourceDensity(this.model.radius, this.model.backgroundIntensityPerSteradian) * ratio;
    required<HTMLElement>(this.root, "#closure-accepted").textContent = format(accepted);
    required<HTMLElement>(this.root, "#closure-coefficient").textContent = format(coefficient);
    required<HTMLElement>(this.root, "#closure-density").textContent = format(density);
    required<HTMLElement>(this.root, "#closure-direct-law").textContent = `${ratio.toFixed(2)} · R²/r², наружу`;
    required<HTMLElement>(this.root, "#closure-background-law").textContent = `1.00 · R²/r², к телу`;
    required<HTMLElement>(this.root, "#closure-crossing").textContent = ratio === 1 ? "нет: равны при всех r ≥ R" : "нет: знак один при всех r ≥ R";

    const verdict = ratio === 1
      ? "При κ=1 две направленные ветви имеют одинаковый модуль и противоположное направление на всём внешнем диапазоне. Это безразличное взаимное сокращение, а не отдельная граница упора."
      : ratio < 1
        ? "При κ<1 внешний остаток сильнее на всех r≥R. Обе кривые имеют одну форму 1/r², поэтому конечной точки пересечения нет."
        : "При κ>1 прямой выход тела сильнее на всех r≥R. Обе кривые имеют одну форму 1/r², поэтому конечной точки пересечения нет.";
    required<HTMLElement>(this.root, "#closure-direction-verdict").textContent = verdict;
    required<HTMLElement>(this.root, "#closure-conclusion-text").textContent = `${verdict} Различие действительно существует в полной угловой и скалярной загрузке W0: W0 тела, deficit и surviving имеют разные ближние профили. Но устойчивый радиус нельзя извлечь из двух неизменных внешних W1∝1/r². Для этого нужен следующий геометрический механизм: протяжённый приёмник, частичная непрозрачность, перенаправление или реальная зона перекрытия.`;
  }

  private renderScalar(samples: ScalarChannels[]): void {
    const context = this.scalarCanvas.getContext("2d");
    if (!context) throw new Error("Scalar canvas unavailable");
    const yMin = 0;
    const yMax = Math.max(4.2, 3.2 * this.model.sourceToMatchedRatio);
    const geometry = this.drawAxes(context, this.scalarCanvas, yMin, yMax, [0, 1, 2, 3, 4]);
    this.drawSeries(context, this.scalarCanvas, geometry, samples, sample => sample.bodyW0, yMin, yMax, "#66c2a7", 3);
    this.drawSeries(context, this.scalarCanvas, geometry, samples, sample => sample.backgroundIncident, yMin, yMax, "#e5d58d", 2, true);
    this.drawSeries(context, this.scalarCanvas, geometry, samples, sample => sample.backgroundStraightSurviving, yMin, yMax, "#8aa7ff", 2.4);
    this.drawSeries(context, this.scalarCanvas, geometry, samples, sample => sample.backgroundStraightDeficit, yMin, yMax, "#ef8f70", 2.4);
    context.fillStyle = "rgba(218,235,228,0.78)";
    context.fillText("W0 / (πI)", 8, 17);
  }

  private renderVector(samples: ScalarChannels[]): void {
    const context = this.vectorCanvas.getContext("2d");
    if (!context) throw new Error("Vector canvas unavailable");
    const maxMagnitude = Math.max(1.2, 1.15 * this.model.sourceToMatchedRatio);
    const yMin = -1.2;
    const yMax = maxMagnitude;
    const geometry = this.drawAxes(context, this.vectorCanvas, yMin, yMax, [-1, -0.5, 0, 0.5, 1]);
    this.drawSeries(context, this.vectorCanvas, geometry, samples, sample => sample.directBodyOutgoingSigned, yMin, yMax, "#66c2a7", 3);
    this.drawSeries(context, this.vectorCanvas, geometry, samples, sample => sample.externalBackgroundResidualSigned, yMin, yMax, "#ef8f70", 3);
    this.drawSeries(context, this.vectorCanvas, geometry, samples, sample => sample.netDirectionalSigned, yMin, yMax, "#f3e3ac", 2.2, true);
    context.fillStyle = "rgba(218,235,228,0.78)";
    context.fillText("signed W1 / (πI)", 8, 17);
  }

  private exportReceipt(): void {
    const exterior = [1, 1.05, 1.2, 1.5, 2, 3, 5, 8].map(ratio => ({
      ratio,
      raw: oneBodyClosureSample(ratio * this.model.radius, this.model),
      normalized: normalizedOneBodyClosureSample(ratio * this.model.radius, this.model),
    }));
    const receipt = {
      receipt_version: "A0.3",
      app_commit: APP_COMMIT,
      generated_at: new Date().toISOString(),
      model: this.model,
      source_classification: {
        viktor_body_as_source: true,
        viktor_complex_as_base_tension: true,
        local_received_equals_local_reradiated: "CONDITIONAL_CLOSURE_NOT_SOURCE_CANON",
      },
      closure_assumptions: [
        "FULL_ACCEPTANCE_BY_SPHERE",
        "STATIONARY_LOCAL_BALANCE",
        "NO_ACTION_DESTRUCTION_OR_STORAGE",
        "ISOTROPIC_OUTGOING_REDISTRIBUTION_OVER_4PI",
      ],
      exact_relations: {
        total_accepted: "4*pi^2*I*R^2",
        matched_outgoing_coefficient: "pi*I*R^2",
        body_w1_inside: "(4*pi/3)*q*r",
        body_w1_outside: "q*V/r^2",
        background_residual_outside: "pi*I*R^2/r^2",
        net_outside: "(kappa-1)*pi*I*R^2/r^2",
      },
      result: this.model.sourceToMatchedRatio === 1
        ? "EXACT_EXTERNAL_CANCELLATION_AT_ALL_RADII_NO_FINITE_EQUILIBRIUM"
        : "NO_FINITE_CROSSING_FOR_CONSTANT_SOURCE_RATIO",
      exterior_samples: exterior,
      firewalls: [
        "NO_LIGHT_IDENTITY_CLAIM",
        "NO_LOCAL_RERADIATION_AS_SOURCE_CANON",
        "NO_PHYSICAL_FORCE",
        "NO_UPOR_CLAIM",
        "NO_SCALE_BINDING",
        "NO_VALIDATION",
        "NO_CANON_PROMOTION",
      ],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "VOXELLAB_ACTION_TRANSPORT_A0_3_ONE_BODY_CLOSURE_RECEIPT.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
}
