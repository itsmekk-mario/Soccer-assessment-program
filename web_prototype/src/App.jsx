import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

// -----------------------------
// 1. 탐구 모델에서 사용하는 기본 상수
// -----------------------------

// 물리 상수는 사용자가 제시한 값을 그대로 사용합니다.
const PLANCK_CONSTANT = 6.626e-34; // h, 단위: J*s
const LIGHT_SPEED = 3.0e8; // c, 단위: m/s
const AVOGADRO_NUMBER = 6.022e23; // N_A, 단위: mol^-1

// 수행평가 발표 화면이 바로 보이도록 기본값을 지정합니다.
const DEFAULT_WAVELENGTH_NM = 312;
const DEFAULT_SEQUENCE = "GEAGPQGPRGSEGPQGVRGEPGPPGPASAAGPA";

// pLDDT가 낮다고 가정한 예시 구간입니다.
// 실제 AlphaFold 결과를 넣는 단계로 확장할 수 있지만, 이 웹페이지는 교육용 모델입니다.
const LOW_PLDDT_RANGES = [
  [6, 9],
  [24, 28]
];

// Recharts 그래프와 배지에 공통으로 쓰는 UV 영역 색상입니다.
const UV_STYLES = {
  "UV-A": {
    text: "UV-A",
    range: "315~400 nm",
    color: "#2563eb",
    pale: "#dbeafe",
    description: "비교적 파장이 긴 자외선 영역"
  },
  "UV-B": {
    text: "UV-B",
    range: "280~315 nm",
    color: "#b45309",
    pale: "#fef3c7",
    description: "단백질 손상 논의와 연결해 볼 수 있는 영역"
  },
  "UV-C": {
    text: "UV-C",
    range: "100~280 nm",
    color: "#be123c",
    pale: "#ffe4e6",
    description: "광자 에너지가 큰 짧은 파장 영역"
  },
  "범위 밖": {
    text: "범위 밖",
    range: "100~400 nm 밖",
    color: "#64748b",
    pale: "#e2e8f0",
    description: "이 시뮬레이터의 자외선 범위를 벗어난 값"
  }
};

const MODEL_STEPS = [
  {
    step: "STEP 01",
    title: "자외선 파장 입력",
    description: "100~400 nm 범위에서 UV-A, UV-B, UV-C 조건을 바꾸며 비교합니다."
  },
  {
    step: "STEP 02",
    title: "광자 에너지 계산",
    description: "E = hc/λ 식으로 파장이 짧아질수록 에너지가 커지는 관계를 확인합니다."
  },
  {
    step: "STEP 03",
    title: "COL1A1 서열 취약도 분석",
    description: "Gly(G), Pro(P), Ala(A)와 낮은 pLDDT 가정 구간을 함께 표시합니다."
  },
  {
    step: "STEP 04",
    title: "콜라겐 변성 가능성 시각화",
    description: "에너지, UV 영역, 서열 취약도를 연결해 교육용 점수로 나타냅니다."
  }
];

const DOMAIN_LINKS = [
  {
    title: "Physics",
    text: "파장과 광자 에너지의 반비례 관계를 계산합니다."
  },
  {
    title: "Chemistry",
    text: "고에너지 UV가 결합 손상 가능성과 연결될 수 있음을 해석합니다."
  },
  {
    title: "Biology",
    text: "COL1A1 서열, Gly/Pro 반복, pLDDT 구간을 콜라겐 구조와 연결합니다."
  },
  {
    title: "Digital Twin",
    text: "실제 실험을 대체하는 예측이 아니라, 조건 변화에 따른 가능성을 가상 모델로 비교합니다."
  }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isInRange(position, ranges) {
  return ranges.some(([start, end]) => position >= start && position <= end);
}

// -----------------------------
// 2. 필수 계산 함수
// -----------------------------

export function calculateEnergyKJmol(wavelengthNm) {
  // nm 단위 파장을 m 단위로 변환합니다.
  const wavelengthM = wavelengthNm * 1e-9;

  // 광자 1개의 에너지는 E = hc/lambda 입니다.
  const energyJPerPhoton = (PLANCK_CONSTANT * LIGHT_SPEED) / wavelengthM;

  // 1몰의 광자 에너지를 구한 뒤 J/mol을 kJ/mol로 변환합니다.
  return (energyJPerPhoton * AVOGADRO_NUMBER) / 1000;
}

export function classifyUV(wavelengthNm) {
  // 경계값이 겹치지 않도록 315 nm는 UV-A, 280 nm는 UV-B에 포함했습니다.
  if (wavelengthNm >= 315 && wavelengthNm <= 400) return "UV-A";
  if (wavelengthNm >= 280 && wavelengthNm < 315) return "UV-B";
  if (wavelengthNm >= 100 && wavelengthNm < 280) return "UV-C";
  return "범위 밖";
}

export function evaluateDamagePotential(energy) {
  // 이 평가는 실제 실험값이 아니라 발표용 정성 해석 기준입니다.
  if (energy >= 400) return "결합 손상 가능성이 큰 고에너지 영역";
  if (energy >= 300) return "단백질 손상에 관여할 수 있는 영역";
  return "상대적으로 낮은 에너지 영역";
}

export function calculateDenaturationScore(wavelengthNm, energy) {
  // 문제에서 제시한 단순 점수식을 그대로 바탕으로 사용합니다.
  const energyScore = clamp((energy - 250) / 2, 0, 100);
  const uvType = classifyUV(wavelengthNm);

  // UV 영역별 보정값입니다. 짧은 파장일수록 에너지 영향이 커지는 경향을 단순 반영합니다.
  const uvAdjustment = {
    "UV-C": 20,
    "UV-B": 10,
    "UV-A": -10,
    "범위 밖": 0
  }[uvType];

  return clamp(energyScore + uvAdjustment, 0, 100);
}

export function analyzeCollagenSequence(sequence, denaturationScore) {
  // 서열 각 위치에 대해 잔기 종류, pLDDT 예시 구간, 탐구용 취약도 점수를 계산합니다.
  return sequence.split("").map((residue, index) => {
    const position = index + 1;
    const isGly = residue === "G";
    const isPro = residue === "P";
    const isAla = residue === "A";
    const isLowPlddt = isInRange(position, LOW_PLDDT_RANGES);

    // Gly/Pro는 콜라겐 반복 구조에서 중요하지만, 곁사슬 구조와 결합 유연성 때문에
    // 주변 연결력이 상대적으로 낮은 지점으로 해석해 취약도 가중치를 둡니다.
    const lowConnectivityScore = (isGly ? 18 : 0) + (isPro ? 18 : 0);
    const residueScore = lowConnectivityScore + (isAla ? 8 : 0);
    const plddtScore = isLowPlddt ? 18 : 0;
    const uvBoost = denaturationScore * 0.35;
    const vulnerability = clamp(20 + residueScore + plddtScore + uvBoost, 0, 100);

    return {
      position,
      residue,
      isGly,
      isPro,
      isAla,
      isLowPlddt,
      vulnerability: Number(vulnerability.toFixed(1))
    };
  });
}

export function generateEnergyCurve() {
  // 100~400 nm를 1 nm 간격으로 계산해 파장이 짧을수록 에너지가 커지는 관계를 보여줍니다.
  return Array.from({ length: 301 }, (_, index) => {
    const wavelength = index + 100;
    const energy = calculateEnergyKJmol(wavelength);
    return {
      wavelength,
      energy: Number(energy.toFixed(1)),
      uvType: classifyUV(wavelength)
    };
  });
}

export function generateDenaturationCurve() {
  // 파장별 교육용 변성 가능성 점수를 계산해 선그래프 데이터로 사용합니다.
  return Array.from({ length: 301 }, (_, index) => {
    const wavelength = index + 100;
    const energy = calculateEnergyKJmol(wavelength);
    const score = calculateDenaturationScore(wavelength, energy);
    return {
      wavelength,
      score: Number(score.toFixed(1)),
      energy: Number(energy.toFixed(1)),
      uvType: classifyUV(wavelength)
    };
  });
}

// -----------------------------
// 3. 화면 표시용 보조 함수
// -----------------------------

function formatNumber(value, digits = 1) {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function getScoreTone(score) {
  if (score >= 75) return "높음";
  if (score >= 45) return "중간";
  return "낮음";
}

function ResidueBadge({ item }) {
  const baseClass =
    "inline-flex h-8 min-w-8 items-center justify-center border px-2 text-sm font-extrabold";

  if (item.isGly) {
    return (
      <span className={`${baseClass} border-blue-200 bg-blue-50 text-blue-700`}>
        G
      </span>
    );
  }

  if (item.isPro) {
    return (
      <span className={`${baseClass} border-amber-200 bg-amber-50 text-amber-700`}>
        P
      </span>
    );
  }

  if (item.isAla) {
    return (
      <span className={`${baseClass} border-rose-200 bg-rose-50 text-rose-700`}>
        A
      </span>
    );
  }

  return (
    <span className={`${baseClass} border-slate-200 bg-white text-slate-600`}>
      {item.residue}
    </span>
  );
}

function MetricBlock({ label, value, helper, accent }) {
  return (
    <div className="border border-slateLine bg-white px-5 py-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-ink" style={{ color: accent }}>
        {value}
      </p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <section className={`border border-slateLine bg-white p-5 shadow-sm ${className}`}>
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function UvBandBackground() {
  return (
    <>
      <ReferenceArea x1={100} x2={280} fill={UV_STYLES["UV-C"].pale} fillOpacity={0.65} />
      <ReferenceArea x1={280} x2={315} fill={UV_STYLES["UV-B"].pale} fillOpacity={0.65} />
      <ReferenceArea x1={315} x2={400} fill={UV_STYLES["UV-A"].pale} fillOpacity={0.65} />
    </>
  );
}

function CustomTooltip({ active, payload, label, unit, valueKey }) {
  if (!active || !payload?.length) return null;

  const item = payload.find((entry) => entry.dataKey === valueKey) ?? payload[0];
  return (
    <div className="border border-slateLine bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-bold text-ink">{label} nm</p>
      <p className="text-slate-600">
        {item.name}: {formatNumber(item.value, 1)} {unit}
      </p>
      {payload[0]?.payload?.uvType ? (
        <p className="text-slate-500">{payload[0].payload.uvType}</p>
      ) : null}
    </div>
  );
}

// -----------------------------
// 4. React 화면
// -----------------------------

export default function App() {
  const [wavelengthNm, setWavelengthNm] = useState(DEFAULT_WAVELENGTH_NM);

  // 슬라이더 값이 바뀔 때만 주요 계산값을 다시 계산합니다.
  const energy = useMemo(() => calculateEnergyKJmol(wavelengthNm), [wavelengthNm]);
  const uvType = useMemo(() => classifyUV(wavelengthNm), [wavelengthNm]);
  const damagePotential = useMemo(() => evaluateDamagePotential(energy), [energy]);
  const denaturationScore = useMemo(
    () => calculateDenaturationScore(wavelengthNm, energy),
    [wavelengthNm, energy]
  );

  // 곡선 데이터는 입력값과 상관없이 고정 범위를 계산하므로 최초 1회만 만들면 됩니다.
  const energyCurve = useMemo(() => generateEnergyCurve(), []);
  const denaturationCurve = useMemo(() => generateDenaturationCurve(), []);

  // 현재 점수에 맞춰 서열 위치별 취약도 그래프 데이터를 갱신합니다.
  const sequenceAnalysis = useMemo(
    () => analyzeCollagenSequence(DEFAULT_SEQUENCE, denaturationScore),
    [denaturationScore]
  );

  const uvStyle = UV_STYLES[uvType];
  const selectedEnergy = Number(energy.toFixed(1));
  const selectedScore = Number(denaturationScore.toFixed(1));
  const scoreTone = getScoreTone(denaturationScore);

  const glyCount = sequenceAnalysis.filter((item) => item.isGly).length;
  const proCount = sequenceAnalysis.filter((item) => item.isPro).length;
  const alaCount = sequenceAnalysis.filter((item) => item.isAla).length;

  return (
    <main className="min-h-screen bg-paper px-5 py-6 text-ink lg:px-9">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-slateLine pb-5">
          <p className="text-sm font-extrabold text-collagen">생명과학 수행평가 웹 시뮬레이터</p>
          <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight text-ink lg:text-4xl">
                디지털 트윈 기반 자외선-콜라겐 변성 가능성 분석
              </h1>
              <p className="mt-2 text-base text-slate-600">
                발표 PDF의 탐구 흐름을 반영해 자외선 파장, 광자 에너지, COL1A1 서열,
                Gly/Pro 연결력, 콜라겐 변성 가능성을 하나의 교육용 시뮬레이션으로 연결했습니다.
              </p>
            </div>
            <div
              className="border px-5 py-3"
              style={{ borderColor: uvStyle.color, backgroundColor: uvStyle.pale }}
            >
              <p className="text-sm font-bold text-slate-600">현재 UV 영역</p>
              <p className="text-2xl font-extrabold" style={{ color: uvStyle.color }}>
                {uvStyle.text}
              </p>
              <p className="text-sm text-slate-600">{uvStyle.range}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="border border-slateLine bg-white p-5 shadow-sm">
            <p className="text-sm font-extrabold text-collagen">Research Question</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight text-ink">
              자외선 파장이 짧아질수록 콜라겐 구조의 변성 가능성은 어떻게 달라질까?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              PDF 발표 자료의 핵심은 자외선 파장과 에너지 계산을 생명과학 개념에 연결하는
              것입니다. 이 웹사이트는 실제 피부 실험을 대신하는 예측 도구가 아니라, 조건을
              바꿔 보며 파장-에너지-서열 취약도-콜라겐 변성 가능성의 관계를 이해하는
              디지털 트윈형 탐구 모델입니다.
            </p>
          </div>

          <div className="border border-slateLine bg-ink p-5 text-white shadow-sm">
            <p className="text-sm font-extrabold text-orange-200">Model Hypothesis</p>
            <p className="mt-2 text-lg font-extrabold leading-7">
              UV 에너지가 커지고 Gly/Pro처럼 주변 연결력이 낮게 해석되는 위치가 겹치면,
              콜라겐 변성 가능성 점수가 높아질 것이다.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              단, 이 점수는 실제 변성 확률이 아니라 발표용으로 설계한 상대 비교 지표입니다.
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 lg:grid-cols-4">
          {MODEL_STEPS.map((item) => (
            <div key={item.step} className="border border-slateLine bg-white p-4 shadow-sm">
              <p className="text-xs font-extrabold text-collagen">{item.step}</p>
              <h3 className="mt-2 text-base font-extrabold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-3 lg:grid-cols-4">
          {DOMAIN_LINKS.map((item) => (
            <div key={item.title} className="border border-slateLine bg-white px-4 py-3">
              <p className="text-sm font-extrabold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-4">
          <MetricBlock
            label="현재 파장"
            value={`${wavelengthNm} nm`}
            helper="슬라이더로 100~400 nm 조절"
            accent={uvStyle.color}
          />
          <MetricBlock
            label="광자 1몰당 에너지"
            value={`${formatNumber(energy, 1)}`}
            helper="kJ/mol"
            accent="#c2410c"
          />
          <MetricBlock
            label="교육용 변성 가능성 점수"
            value={`${formatNumber(denaturationScore, 1)}`}
            helper={`${scoreTone} 수준의 정성적 해석`}
            accent="#7c3aed"
          />
          <MetricBlock
            label="정성 평가"
            value={scoreTone}
            helper={damagePotential}
            accent="#0f766e"
          />
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="grid gap-5">
            <Section title="파장 조절">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">선택한 파장</p>
                  <p className="mt-1 text-5xl font-extrabold" style={{ color: uvStyle.color }}>
                    {wavelengthNm}
                    <span className="ml-2 text-xl text-slate-500">nm</span>
                  </p>
                </div>
                <div
                  className="border px-4 py-3 text-right"
                  style={{ borderColor: uvStyle.color, backgroundColor: uvStyle.pale }}
                >
                  <p className="text-sm font-bold text-slate-600">{uvStyle.description}</p>
                  <p className="mt-1 text-xl font-extrabold" style={{ color: uvStyle.color }}>
                    {uvType}
                  </p>
                </div>
              </div>

              <input
                className="mt-6 h-2 w-full cursor-pointer"
                type="range"
                min="100"
                max="400"
                step="1"
                value={wavelengthNm}
                onChange={(event) => setWavelengthNm(Number(event.target.value))}
                aria-label="자외선 파장 조절"
              />

              <div className="mt-3 flex justify-between text-sm font-semibold text-slate-500">
                <span>100 nm</span>
                <span>280</span>
                <span>315</span>
                <span>400 nm</span>
              </div>

              <div className="mt-4 grid grid-cols-3 border border-slateLine text-center text-sm font-bold">
                <span className="bg-rose-50 py-2 text-uvc">UV-C</span>
                <span className="bg-amber-50 py-2 text-uvb">UV-B</span>
                <span className="bg-blue-50 py-2 text-uva">UV-A</span>
              </div>
            </Section>

            <Section title="에너지 계산">
              <div className="space-y-3 text-sm leading-6 text-slate-700">
                <p className="font-bold text-ink">E = hc / λ</p>
                <p className="font-bold text-ink">E_mol = hcN_A / λ</p>
                <p>h = 6.626 × 10^-34 J·s</p>
                <p>c = 3.00 × 10^8 m/s</p>
                <p>N_A = 6.022 × 10^23 mol^-1</p>
              </div>
              <div className="mt-5 border-l-4 border-collagen bg-orange-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-600">계산 결과</p>
                <p className="mt-1 text-3xl font-extrabold text-collagen">
                  {formatNumber(energy, 2)} kJ/mol
                </p>
              </div>
            </Section>

            <Section title="결합 손상 가능성 평가">
              <p className="text-lg font-extrabold text-ink">{damagePotential}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                이 값은 자외선 파장의 광자 에너지를 기준으로 한 정성적 해석입니다.
                실제 변성은 흡수율, 노출 시간, 수분, 활성산소, 주변 생체 환경의 영향을
                함께 받습니다.
              </p>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="border border-slateLine px-3 py-2">400 kJ/mol 이상: 결합 손상 가능성이 큰 고에너지 영역</p>
                <p className="border border-slateLine px-3 py-2">300~400 kJ/mol: 단백질 손상에 관여할 수 있는 영역</p>
                <p className="border border-slateLine px-3 py-2">300 kJ/mol 미만: 상대적으로 낮은 에너지 영역</p>
              </div>
            </Section>
          </div>

          <div className="grid gap-5">
            <Section title="콜라겐 변성 가능성 그래프">
              <p className="mb-3 text-sm text-slate-600">
                점수는 실제 실험값이 아니라 에너지와 UV 영역 보정을 연결한 교육용 단순 모델입니다.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={denaturationCurve} margin={{ top: 15, right: 22, bottom: 12, left: 0 }}>
                    <UvBandBackground />
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                    <XAxis
                      dataKey="wavelength"
                      type="number"
                      domain={[100, 400]}
                      ticks={[100, 180, 280, 315, 400]}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 12 }} />
                    <Tooltip
                      content={<CustomTooltip unit="점" valueKey="score" />}
                    />
                    <Legend />
                    <ReferenceLine x={wavelengthNm} stroke="#111827" strokeWidth={2}>
                      <Label value="현재 파장" position="insideTopRight" fill="#111827" />
                    </ReferenceLine>
                    <ReferenceDot
                      x={wavelengthNm}
                      y={selectedScore}
                      r={6}
                      fill="#7c3aed"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="변성 가능성 점수"
                      stroke="#7c3aed"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="파장별 에너지 그래프">
              <p className="mb-3 text-sm text-slate-600">
                파장이 짧아질수록 E = hc/λ 관계에 따라 광자 1몰당 에너지가 커집니다.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={energyCurve} margin={{ top: 15, right: 22, bottom: 12, left: 0 }}>
                    <UvBandBackground />
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                    <XAxis
                      dataKey="wavelength"
                      type="number"
                      domain={[100, 400]}
                      ticks={[100, 180, 280, 315, 400]}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[250, 1200]}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <Tooltip
                      content={<CustomTooltip unit="kJ/mol" valueKey="energy" />}
                    />
                    <Legend />
                    <ReferenceLine y={300} stroke="#64748b" strokeDasharray="4 4" />
                    <ReferenceLine y={400} stroke="#be123c" strokeDasharray="4 4" />
                    <ReferenceLine x={wavelengthNm} stroke="#111827" strokeWidth={2}>
                      <Label value="현재 파장" position="insideTopRight" fill="#111827" />
                    </ReferenceLine>
                    <ReferenceDot
                      x={wavelengthNm}
                      y={selectedEnergy}
                      r={6}
                      fill="#c2410c"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="energy"
                      name="에너지"
                      stroke="#c2410c"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
          <Section title="COL1A1 일부 서열의 위치별 변성 취약도">
            <p className="mb-3 text-sm text-slate-600">
              Gly(G), Pro(P)는 콜라겐 구조에서 반복적으로 등장하지만 주변 연결력이
              상대적으로 낮은 지점으로 해석해 가중치를 부여했습니다. Ala(A)와 pLDDT가
              낮다고 가정한 구간도 함께 표시한 교육용 취약도 그래프입니다.
            </p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={sequenceAnalysis}
                  margin={{ top: 15, right: 22, bottom: 12, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                  <XAxis
                    dataKey="position"
                    tick={{ fill: "#475569", fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name, props) => {
                      if (name === "취약도") return [`${formatNumber(value, 1)} 점`, name];
                      return [value, name, props];
                    }}
                    labelFormatter={(label) => `${label}번 위치`}
                  />
                  <Legend />
                  <ReferenceLine y={70} stroke="#be123c" strokeDasharray="4 4">
                    <Label value="높은 취약도 기준" position="insideTopRight" fill="#be123c" />
                  </ReferenceLine>
                  <Bar dataKey="vulnerability" name="취약도" radius={[3, 3, 0, 0]}>
                    {sequenceAnalysis.map((item) => {
                      let color = "#94a3b8";
                      if (item.isGly) color = "#2563eb";
                      if (item.isPro) color = "#b45309";
                      if (item.isAla) color = "#be123c";
                      if (item.isLowPlddt) color = "#7c3aed";

                      return <Cell key={item.position} fill={color} />;
                    })}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="콜라겐 서열 분석 영역">
            <p className="text-sm font-semibold text-slate-500">예시 COL1A1 일부 서열</p>
            <p className="mt-1 break-all font-mono text-sm font-bold text-ink">{DEFAULT_SEQUENCE}</p>

            <div className="mt-4 flex flex-wrap gap-1">
              {sequenceAnalysis.map((item) => (
                <div key={item.position} className="text-center">
                  <ResidueBadge item={item} />
                  <p className="mt-1 text-[10px] text-slate-400">{item.position}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="border border-blue-200 bg-blue-50 px-2 py-3 text-blue-700">
                <p className="font-extrabold">Gly(G)</p>
                <p>{glyCount}개</p>
              </div>
              <div className="border border-amber-200 bg-amber-50 px-2 py-3 text-amber-700">
                <p className="font-extrabold">Pro(P)</p>
                <p>{proCount}개</p>
              </div>
              <div className="border border-rose-200 bg-rose-50 px-2 py-3 text-rose-700">
                <p className="font-extrabold">Ala(A)</p>
                <p>{alaCount}개</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <p>
                Gly(G)와 Pro(P)가 반복되는 구간은 콜라겐 삼중나선의 핵심 구조이지만,
                잔기 특성상 주변 연결력이 상대적으로 낮은 지점으로 해석할 수 있어
                자외선 에너지와 함께 취약도 가중치에 반영했습니다.
              </p>
              <p>
                A는 비교적 작은 곁사슬을 가진 아미노산이므로 유연성과 관련된 가능성으로
                해석할 수 있지만, 단일 잔기만으로 변성을 단정하지 않습니다.
              </p>
              <p>
                보라색 막대는 pLDDT가 낮다고 가정한 예시 구간입니다. pLDDT는 구조 예측
                신뢰도 지표이며 변성 확률 자체를 뜻하지 않습니다.
              </p>
            </div>
          </Section>
        </div>

        <Section title="탐구 한계" className="mt-5">
          <div className="grid gap-3 text-sm leading-6 text-slate-700 lg:grid-cols-3">
            <p className="border-l-4 border-collagen bg-orange-50 px-4 py-3">
              이 웹 시뮬레이터는 실제 단백질 변성을 정확히 예측하는 도구가 아니라,
              자외선 파장과 에너지, 콜라겐 서열 정보를 연결하여 변성 가능성을 이해하기 위한
              교육용 모델이다.
            </p>
            <p className="border-l-4 border-uva bg-blue-50 px-4 py-3">
              AlphaFold는 정적인 단백질 구조 예측 도구이므로 실제 자외선 조사에 따른
              동적 변성 과정을 직접 보여주지는 않는다.
            </p>
            <p className="border-l-4 border-uvc bg-rose-50 px-4 py-3">
              실제 콜라겐 변성은 자외선 흡수율, 노출 시간, 수분, 활성산소, 생체 환경 등
              다양한 요인의 영향을 받는다.
            </p>
          </div>
        </Section>

        <Section title="PDF 발표 내용 기반 결론" className="mt-5">
          <div className="grid gap-3 text-sm leading-6 text-slate-700 lg:grid-cols-3">
            <p className="border border-slateLine bg-white px-4 py-3">
              파장이 짧아질수록 광자 에너지가 커지므로 UV-C와 일부 UV-B 조건에서 결합 손상
              가능성을 더 크게 해석할 수 있다.
            </p>
            <p className="border border-slateLine bg-white px-4 py-3">
              COL1A1 서열에서 Gly/Pro 반복 구간은 콜라겐 구조의 핵심이지만, 연결력이 낮은
              위치로 해석될 수 있어 에너지 조건과 함께 취약도 판단에 반영했다.
            </p>
            <p className="border border-slateLine bg-white px-4 py-3">
              이 웹사이트는 생명과학 개념과 물리 계산, 컴퓨터 시뮬레이션을 연결하여
              콜라겐 변성 가능성을 시각적으로 탐구하는 디지털 트윈 모델이다.
            </p>
          </div>
        </Section>
      </div>
    </main>
  );
}
