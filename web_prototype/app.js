const canvas = document.querySelector("#overlayCanvas");
const ctx = canvas.getContext("2d");
const pitchMapCanvas = document.querySelector("#pitchMapCanvas");
const pitchCtx = pitchMapCanvas.getContext("2d");
const mediaInput = document.querySelector("#mediaInput");
const ipadCaptureInput = document.querySelector("#ipadCaptureInput");
const tracksInput = document.querySelector("#tracksInput");
const dropZone = document.querySelector("#dropZone");
const cameraButton = document.querySelector("#cameraButton");
const cameraStatus = document.querySelector("#cameraStatus");
const tracksStatus = document.querySelector("#tracksStatus");
const calibrateButton = document.querySelector("#calibrateButton");
const calibrationStatus = document.querySelector("#calibrationStatus");
const coverageRange = document.querySelector("#coverageRange");
const videoSource = document.querySelector("#videoSource");
const imageSource = document.querySelector("#imageSource");
const emptyState = document.querySelector("#emptyState");
const playButton = document.querySelector("#playButton");
const scrubber = document.querySelector("#scrubber");
const frameInfo = document.querySelector("#frameInfo");
const labelList = document.querySelector("#labelList");
const personCount = document.querySelector("#personCount");
const ballCount = document.querySelector("#ballCount");
const pressureValue = document.querySelector("#pressureValue");
const possessionValue = document.querySelector("#possessionValue");
const estimatedCount = document.querySelector("#estimatedCount");
const confidenceValue = document.querySelector("#confidenceValue");
const summaryText = document.querySelector("#summaryText");
const eventLog = document.querySelector("#eventLog");
const fileMeta = document.querySelector("#fileMeta");
const estimateList = document.querySelector("#estimateList");
const projectionStatus = document.querySelector("#projectionStatus");
const clockValue = document.querySelector("#clockValue");
const modeValue = document.querySelector("#modeValue");
const showPersons = document.querySelector("#showPersons");
const showBall = document.querySelector("#showBall");
const showZones = document.querySelector("#showZones");
const modeButtons = [...document.querySelectorAll("[data-mode]")];

const PERSON_ALIASES = new Set(["person", "player", "referee", "human", "people", "man", "woman"]);

const COLORS = {
  person: "#65c77a",
  ball: "#f3bd4f",
  zone: "rgba(240, 113, 103, 0.18)",
  estimate: "#c9e96d",
  coverage: "rgba(98, 168, 232, 0.18)"
};

const PITCH = {
  length: 105,
  width: 68
};

const state = {
  sourceType: "sample",
  mode: "live",
  playing: false,
  frame: 128,
  mediaUrl: null,
  mediaFile: null,
  mediaDuration: null,
  cameraStream: null,
  detections: [],
  tracksLoaded: false,
  tracksByFrame: new Map(),
  maxTrackFrame: 0,
  calibrated: false,
  coveragePercent: 58,
  spatialModel: {
    observed: [],
    estimated: [],
    averageConfidence: 0
  }
};

function normalizeLabel(label) {
  const key = String(label).trim().toLowerCase();
  return PERSON_ALIASES.has(key) ? "person" : key;
}

function px(value, axis) {
  return axis === "x" ? (value / 100) * canvas.width : (value / 100) * canvas.height;
}

function imagePercentToPitch(point) {
  if (Number.isFinite(point.pitchX) && Number.isFinite(point.pitchY)) {
    return { x: point.pitchX, y: point.pitchY };
  }

  return {
    x: (point.x / 100) * PITCH.length,
    y: (point.y / 100) * PITCH.width
  };
}

function pitchToMap(point) {
  return {
    x: (point.x / PITCH.length) * pitchMapCanvas.width,
    y: (point.y / PITCH.width) * pitchMapCanvas.height
  };
}

function getCoverageBounds() {
  const width = state.coveragePercent;
  const center = 50 + Math.sin(state.frame / 90) * 9;
  return {
    left: Math.max(0, center - width / 2),
    right: Math.min(100, center + width / 2),
    top: 8,
    bottom: 92
  };
}

function isInCoveragePitch(point) {
  const bounds = getCoverageBounds();
  const xPercent = (point.x / PITCH.length) * 100;
  const yPercent = (point.y / PITCH.width) * 100;
  return xPercent >= bounds.left && xPercent <= bounds.right && yPercent >= bounds.top && yPercent <= bounds.bottom;
}

function drawFieldGuides() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, canvas.height * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCoverageOverlay() {
  const bounds = getCoverageBounds();

  ctx.save();
  ctx.fillStyle = COLORS.coverage;
  ctx.strokeStyle = "rgba(98, 168, 232, 0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px(bounds.left, "x"), px(bounds.top, "y"));
  ctx.lineTo(px(bounds.right, "x"), px(bounds.top + 6, "y"));
  ctx.lineTo(px(bounds.right, "x"), px(bounds.bottom - 6, "y"));
  ctx.lineTo(px(bounds.left, "x"), px(bounds.bottom, "y"));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPressureZones(detections) {
  if (!showZones.checked) return;

  const ball = detections.find((item) => item.label === "ball");
  if (!ball) return;

  ctx.save();
  ctx.fillStyle = COLORS.zone;
  ctx.strokeStyle = "rgba(240, 113, 103, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px(ball.x, "x"), px(ball.y, "y"), canvas.width * 0.15, canvas.height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDetection(item) {
  if (item.label === "person" && !showPersons.checked) return;
  if (item.label === "ball" && !showBall.checked) return;

  const x = px(item.x, "x");
  const y = px(item.y, "y");
  const w = px(item.w, "x");
  const h = px(item.h, "y");
  const color = item.label === "ball" ? COLORS.ball : COLORS.person;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = "rgba(17,20,19,0.82)";
  ctx.lineWidth = item.label === "ball" ? 3 : 2;

  if (item.label === "ball") {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(w, 9), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  }

  const label = `${item.label} ${(item.confidence * 100).toFixed(0)}%`;
  ctx.font = "700 18px Arial";
  const labelWidth = ctx.measureText(label).width + 16;
  ctx.fillRect(x - w / 2, y - h / 2 - 30, labelWidth, 26);
  ctx.fillStyle = color;
  ctx.fillText(label, x - w / 2 + 8, y - h / 2 - 11);
  ctx.restore();
}

function calculateMetrics(detections) {
  const persons = detections.filter((item) => item.label === "person");
  const visiblePersons = persons.filter((item) => item.status === "visible");
  const balls = detections.filter((item) => item.label === "ball");
  const left = visiblePersons.filter((item) => item.team === "team_blue" || item.team === "A").length;
  const right = visiblePersons.filter((item) => item.team === "team_red" || item.team === "B").length;
  const ball = balls[0];
  const nearBall = ball
    ? visiblePersons.filter((item) => Math.hypot(item.x - ball.x, item.y - ball.y) < 24).length
    : 0;

  return {
    persons: visiblePersons.length,
    balls: balls.length,
    pressure: Math.min(99, Math.round(nearBall * 14 + visiblePersons.length * 3)),
    possession: `${left}:${right}`,
    nearBall
  };
}

function buildSpatialModel(detections) {
  const persons = detections
    .filter((item) => item.label === "person")
    .map((item, index) => ({
      id: `OBS-${index + 1}`,
      team: item.team,
      role: item.id ? `ID ${item.id}` : `ID ${index + 1}`,
      source: item.status === "visible" ? "observed" : "estimated",
      confidence: item.confidence,
      ...imagePercentToPitch(item)
    }));

  const coveredObserved = persons.filter((item) => item.source === "observed" && isInCoveragePitch(item));
  const estimated = persons.filter((item) => item.source === "estimated");

  const all = [...coveredObserved, ...estimated];
  const averageConfidence = all.length
    ? all.reduce((total, item) => total + item.confidence, 0) / all.length
    : 0;

  return {
    observed: coveredObserved,
    estimated,
    averageConfidence
  };
}

function drawPitchMap(model) {
  pitchCtx.clearRect(0, 0, pitchMapCanvas.width, pitchMapCanvas.height);
  pitchCtx.fillStyle = "#244b33";
  pitchCtx.fillRect(0, 0, pitchMapCanvas.width, pitchMapCanvas.height);

  pitchCtx.save();
  pitchCtx.strokeStyle = "rgba(255,255,255,0.72)";
  pitchCtx.lineWidth = 4;
  pitchCtx.strokeRect(18, 18, pitchMapCanvas.width - 36, pitchMapCanvas.height - 36);
  pitchCtx.beginPath();
  pitchCtx.moveTo(pitchMapCanvas.width / 2, 18);
  pitchCtx.lineTo(pitchMapCanvas.width / 2, pitchMapCanvas.height - 18);
  pitchCtx.stroke();
  pitchCtx.beginPath();
  pitchCtx.arc(pitchMapCanvas.width / 2, pitchMapCanvas.height / 2, 92, 0, Math.PI * 2);
  pitchCtx.stroke();
  pitchCtx.strokeRect(18, pitchMapCanvas.height / 2 - 165, 165, 330);
  pitchCtx.strokeRect(pitchMapCanvas.width - 183, pitchMapCanvas.height / 2 - 165, 165, 330);
  pitchCtx.restore();

  const bounds = getCoverageBounds();
  pitchCtx.save();
  pitchCtx.fillStyle = COLORS.coverage;
  pitchCtx.fillRect(
    (bounds.left / 100) * pitchMapCanvas.width,
    (bounds.top / 100) * pitchMapCanvas.height,
    ((bounds.right - bounds.left) / 100) * pitchMapCanvas.width,
    ((bounds.bottom - bounds.top) / 100) * pitchMapCanvas.height
  );
  pitchCtx.restore();

  [...model.estimated, ...model.observed].forEach((item) => {
    const point = pitchToMap(item);
    const isEstimate = item.source === "estimated";
    pitchCtx.save();
    pitchCtx.beginPath();
    pitchCtx.arc(point.x, point.y, isEstimate ? 10 : 12, 0, Math.PI * 2);
    pitchCtx.fillStyle = isEstimate ? COLORS.estimate : COLORS.person;
    pitchCtx.globalAlpha = isEstimate ? 0.72 : 1;
    pitchCtx.fill();
    pitchCtx.strokeStyle = item.team === "A" ? "#62a8e8" : "#f07167";
    pitchCtx.lineWidth = 3;
    pitchCtx.stroke();
    pitchCtx.globalAlpha = 1;
    pitchCtx.fillStyle = "#f2f7f3";
    pitchCtx.font = "700 18px Arial";
    const label = item.role || (item.id ? `ID ${item.id}` : "person");
    pitchCtx.fillText(label, point.x + 14, point.y + 6);
    pitchCtx.restore();
  });
}

function renderEstimates(model) {
  estimateList.innerHTML = model.estimated.slice(0, 5)
    .map((item) => {
      const confidence = Math.round(item.confidence * 100);
      return `<div class="estimate-row"><span>${item.id}</span><strong>${confidence}%</strong><small>${item.x.toFixed(1)}m, ${item.y.toFixed(1)}m | YOLO lost/out_of_view</small></div>`;
    })
    .join("") || `<div class="estimate-row"><span>추정 없음</span><strong>-</strong><small>실제 tracks.csv를 불러오면 표시됩니다</small></div>`;
}

function renderLabels(detections) {
  const counts = detections.reduce((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  labelList.innerHTML = Object.entries(counts)
    .map(([label, count]) => {
      const caption = label === "person" ? "사람 인식 결과는 person으로 통일" : "공 감지";
      return `<div class="label-chip"><span><strong>${label}</strong><br><small>${caption}</small></span><b>${count}</b></div>`;
    })
    .join("") || `<div class="label-chip"><span><strong>대기</strong><br><small>YOLO tracks.csv를 먼저 불러오세요</small></span><b>0</b></div>`;
}

function renderEvents(metrics) {
  const events = state.tracksLoaded
    ? [
        `Frame ${state.frame}: visible person ${metrics.persons}`,
        `Frame ${state.frame}: lost/out_of_view ${state.spatialModel.estimated.length}`,
        `Frame ${state.frame}: average confidence ${Math.round(state.spatialModel.averageConfidence * 100)}%`
      ]
    : ["Python YOLO 분석 후 data/output/tracks.csv를 불러오면 실제 이벤트가 표시됩니다."];

  eventLog.innerHTML = events.map((event) => `<li>${event}</li>`).join("");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function renderFileMeta() {
  const file = state.mediaFile;
  const source = state.sourceType === "camera" ? "실시간 카메라" : file ? file.name : "샘플";
  const type = state.sourceType === "camera" ? "MediaStream" : file ? file.type || "알 수 없음" : "가상 경기장";
  const size = file ? formatBytes(file.size) : "-";
  const duration = state.mediaDuration ? formatDuration(state.mediaDuration) : "-";

  fileMeta.innerHTML = `
    <div><dt>소스</dt><dd>${source}</dd></div>
    <div><dt>형식</dt><dd>${type}</dd></div>
    <div><dt>크기</dt><dd>${size}</dd></div>
    <div><dt>길이</dt><dd>${duration}</dd></div>
  `;
}

function render() {
  state.detections = state.tracksByFrame.get(state.frame) || [];
  state.spatialModel = buildSpatialModel(state.detections);
  const metrics = calculateMetrics(state.detections);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFieldGuides();
  if (state.calibrated) drawCoverageOverlay();
  drawPressureZones(state.detections);
  state.detections.forEach(drawDetection);
  drawPitchMap(state.spatialModel);

  personCount.textContent = metrics.persons;
  ballCount.textContent = metrics.balls;
  pressureValue.textContent = `${metrics.pressure}%`;
  possessionValue.textContent = metrics.possession;
  estimatedCount.textContent = state.spatialModel.estimated.length;
  confidenceValue.textContent = `${Math.round(state.spatialModel.averageConfidence * 100)}%`;
  clockValue.textContent = `00:${String(state.frame % 60).padStart(2, "0")}`;
  frameInfo.textContent = `Frame ${state.frame}`;
  scrubber.max = String(Math.max(100, state.maxTrackFrame));
  scrubber.value = String(Math.min(state.frame, Number(scrubber.max)));
  projectionStatus.textContent = state.calibrated ? `105 x 68m 보정 | 가시 ${state.coveragePercent}%` : "보정 전";
  summaryText.textContent = state.tracksLoaded
    ? `Python YOLO 분석 결과를 표시 중입니다. 현재 프레임에서 visible person ${state.spatialModel.observed.length}명, lost/out_of_view ${state.spatialModel.estimated.length}명입니다.`
    : "이 화면은 더 이상 가짜 person을 만들지 않습니다. 실제 인식은 Python에서 YOLO 분석을 실행한 뒤 tracks.csv를 불러와 표시합니다.";
  renderLabels(state.detections);
  renderEvents(metrics);
  renderEstimates(state.spatialModel);
  renderFileMeta();
}

function tick() {
  if (state.playing && state.tracksLoaded) {
    state.frame += 1;
    if (state.frame > state.maxTrackFrame) state.frame = 0;
    render();
  }
  requestAnimationFrame(tick);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function handleTracksFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const rows = parseCsv(String(reader.result || ""));
    const byFrame = new Map();
    let maxFrame = 0;

    rows.forEach((row) => {
      const frame = Number(row.frame);
      if (!Number.isFinite(frame)) return;
      maxFrame = Math.max(maxFrame, frame);

      const x1 = Number(row.bbox_x1);
      const y1 = Number(row.bbox_y1);
      const x2 = Number(row.bbox_x2);
      const y2 = Number(row.bbox_y2);
      const pitchX = Number(row.pitch_x_m);
      const pitchY = Number(row.pitch_y_m);
      const detection = {
        label: "person",
        id: row.track_id,
        status: row.status || "visible",
        team: row.team_hint || "unknown",
        confidence: Number(row.confidence) || 0,
        x: ((x1 + x2) / 2 / canvas.width) * 100,
        y: ((y1 + y2) / 2 / canvas.height) * 100,
        w: ((x2 - x1) / canvas.width) * 100,
        h: ((y2 - y1) / canvas.height) * 100,
        pitchX,
        pitchY
      };

      if (!byFrame.has(frame)) byFrame.set(frame, []);
      byFrame.get(frame).push(detection);
    });

    state.tracksByFrame = byFrame;
    state.tracksLoaded = true;
    state.maxTrackFrame = maxFrame;
    state.frame = 0;
    tracksStatus.textContent = `${file.name} 로드 완료: ${rows.length}개 기록`;
    modeValue.textContent = "YOLO 결과";
    render();
  });
  reader.readAsText(file);
}

function stopCameraStream() {
  if (!state.cameraStream) return;
  state.cameraStream.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
}

function handleMediaFile(file) {
  if (!file) return;

  stopCameraStream();
  if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
  state.mediaUrl = URL.createObjectURL(file);
  state.mediaFile = file;
  state.mediaDuration = null;
  state.sourceType = "uploaded";
  emptyState.style.display = "none";
  modeValue.textContent = "영상 미리보기";

  videoSource.pause();
  videoSource.removeAttribute("src");
  imageSource.removeAttribute("src");
  videoSource.style.display = "none";
  imageSource.style.display = "none";

  if (file.type.startsWith("video/")) {
    videoSource.src = state.mediaUrl;
    videoSource.style.display = "block";
    videoSource.addEventListener(
      "loadedmetadata",
      () => {
        state.mediaDuration = videoSource.duration;
        renderFileMeta();
      },
      { once: true }
    );
    videoSource.play().catch(() => {});
  } else {
    imageSource.src = state.mediaUrl;
    imageSource.style.display = "block";
  }

  render();
}

async function startLiveCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = "이 브라우저에서는 카메라 접근을 지원하지 않습니다.";
    return;
  }

  try {
    stopCameraStream();
    if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
    state.mediaUrl = null;
    state.mediaFile = null;
    state.mediaDuration = null;
    state.sourceType = "camera";
    state.playing = true;
    playButton.textContent = "Ⅱ";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    state.cameraStream = stream;
    videoSource.srcObject = stream;
    videoSource.removeAttribute("src");
    imageSource.removeAttribute("src");
    imageSource.style.display = "none";
    videoSource.style.display = "block";
    emptyState.style.display = "none";
    modeValue.textContent = "카메라 미리보기";
    cameraStatus.textContent = "카메라 연결됨 - 웹에서는 YOLO 인식을 실행하지 않습니다";
    await videoSource.play();
    render();
  } catch (error) {
    cameraStatus.textContent = `카메라 연결 실패: ${error.message}`;
  }
}

mediaInput.addEventListener("change", (event) => {
  handleMediaFile(event.target.files[0]);
});

ipadCaptureInput.addEventListener("change", (event) => {
  handleMediaFile(event.target.files[0]);
});

tracksInput.addEventListener("change", (event) => {
  handleTracksFile(event.target.files[0]);
});

cameraButton.addEventListener("click", () => {
  if (state.sourceType === "camera" && state.cameraStream) {
    stopCameraStream();
    state.sourceType = "sample";
    state.playing = false;
    videoSource.pause();
    videoSource.srcObject = null;
    videoSource.style.display = "none";
    emptyState.style.display = "grid";
    playButton.textContent = "▶";
    modeValue.textContent = "샘플 분석";
    cameraStatus.textContent = "카메라 정지됨";
    render();
    return;
  }

  startLiveCamera();
});

calibrateButton.addEventListener("click", () => {
  state.calibrated = true;
  calibrationStatus.textContent = "흰선 기준 homography 보정 적용";
  render();
});

coverageRange.addEventListener("input", (event) => {
  state.coveragePercent = Number(event.target.value);
  calibrationStatus.textContent = `카메라 가시 폭 ${state.coveragePercent}%`;
  render();
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  handleMediaFile(event.dataTransfer.files[0]);
});

playButton.addEventListener("click", () => {
  state.playing = !state.playing;
  playButton.textContent = state.playing ? "Ⅱ" : "▶";
  if (state.sourceType === "uploaded" && videoSource.src) {
    state.playing ? videoSource.play().catch(() => {}) : videoSource.pause();
  }
});

scrubber.addEventListener("input", (event) => {
  state.frame = Number(event.target.value);
  render();
});

[showPersons, showBall, showZones].forEach((input) => input.addEventListener("change", render));

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.mode = button.dataset.mode;
    modeValue.textContent = button.textContent;
    render();
  });
});

render();
tick();
