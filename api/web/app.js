const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const importForm = document.querySelector("#importForm");
const fileInput = document.querySelector("#excelFile");
const fileDrop = document.querySelector("#fileDrop");
const fileName = document.querySelector("#fileName");
const fileSize = document.querySelector("#fileSize");
const shipmentType = document.querySelector("#shipmentType");
const containerFields = document.querySelector("#containerFields");
const looseFields = document.querySelector("#looseFields");
const uploadButton = document.querySelector("#uploadButton");
const notice = document.querySelector("#notice");
const records = document.querySelector("#records");
const summaryStrip = document.querySelector("#summaryStrip");
const searchInput = document.querySelector("#searchInput");
const connectionStatus = document.querySelector("#connectionStatus");

let imports = [];

function fieldValue(id) {
  return document.querySelector("#" + id).value.trim();
}

function showLogin(message = "") {
  appView.hidden = true;
  loginView.hidden = false;
  loginError.textContent = message;
  document.querySelector("#accessCode").focus();
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    showLogin(body.message || "Phiên đăng nhập đã hết hạn.");
    throw new Error(body.message || "Vui lòng đăng nhập.");
  }

  if (!response.ok) {
    throw new Error(body.message || "Yêu cầu không thành công.");
  }

  return body;
}

async function initialize() {
  try {
    const session = await jsonRequest("/web/session");

    if (!session.authenticated) {
      showLogin();
      return;
    }

    showApp();
    await loadImports();
  } catch (error) {
    showLogin(error.message);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const button = loginForm.querySelector("button");
  button.disabled = true;

  try {
    await jsonRequest("/web/login", {
      method: "POST",
      body: JSON.stringify({ accessCode: fieldValue("accessCode") })
    });
    loginForm.reset();
    showApp();
    await loadImports();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await jsonRequest("/web/logout", { method: "POST", body: "{}" });
  showLogin();
});

function selectedFile() {
  return fileInput.files?.[0] || null;
}

function renderSelectedFile() {
  const file = selectedFile();
  fileName.textContent = file?.name || "Chưa chọn file";
  fileSize.textContent = file ? formatBytes(file.size) : "";
}

fileInput.addEventListener("change", renderSelectedFile);

for (const eventName of ["dragenter", "dragover"]) {
  fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    fileDrop.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    fileDrop.classList.remove("dragging");
  });
}

fileDrop.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];

  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  renderSelectedFile();
});

shipmentType.addEventListener("change", () => {
  containerFields.hidden = shipmentType.value !== "container";
  looseFields.hidden = shipmentType.value !== "loose";
});

function importParameters(file) {
  const parameters = new URLSearchParams({
    originalFilename: file.name,
    shipmentType: fieldValue("shipmentType"),
    ownerName: fieldValue("ownerName"),
    contactPhone: fieldValue("contactPhone"),
    woodSpecies: fieldValue("woodSpecies"),
    intakeStartDate: fieldValue("intakeStartDate"),
    totalQuantity: fieldValue("totalQuantity"),
    quantityUnit: fieldValue("quantityUnit"),
    declaredVolumeCbm: fieldValue("declaredVolumeCbm")
  });

  if (shipmentType.value === "container") {
    parameters.set("lotName", fieldValue("lotName"));
    parameters.set("container20Count", fieldValue("container20Count"));
    parameters.set("container40Count", fieldValue("container40Count"));
    parameters.set(
      "containerPickupLocation",
      fieldValue("containerPickupLocation")
    );
  }

  if (shipmentType.value === "loose") {
    parameters.set("vesselName", fieldValue("vesselName"));
    parameters.set("woodPickupLocation", fieldValue("woodPickupLocation"));
  }

  return parameters;
}

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = selectedFile();

  if (!file || !/\.xlsx$/i.test(file.name)) {
    showNotice("Vui lòng chọn file Excel .xlsx hợp lệ.", true);
    return;
  }

  uploadButton.disabled = true;
  uploadButton.textContent = "Đang nhập dữ liệu...";
  notice.hidden = true;

  try {
    const response = await fetch(
      "/web-api/imports/raw?" + importParameters(file),
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": file.type || XLSX_MIME },
        body: file
      }
    );
    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      showLogin(body.message || "Phiên đăng nhập đã hết hạn.");
      return;
    }

    if (!response.ok) {
      throw new Error(body.message || "Không thể nhập file Excel.");
    }

    const item = body.import;
    showNotice(
      body.duplicateFile
        ? `File đã tồn tại: ${item.listCode}. Dữ liệu thiếu đã được bổ sung.`
        : `Đã nhập ${item.importedRows} cây, ${formatVolume(item.totalVolumeCbm)}.`
    );
    importForm.reset();
    containerFields.hidden = true;
    looseFields.hidden = true;
    renderSelectedFile();
    await loadImports();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "Nhập dữ liệu";
  }
});

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle("error", isError);
  notice.hidden = false;
}

async function loadImports() {
  connectionStatus.textContent = "Đang đồng bộ";

  try {
    const body = await jsonRequest("/web-api/imports");
    imports = body.imports || [];
    renderImports();
    connectionStatus.textContent = "Đã kết nối";
  } catch (error) {
    connectionStatus.textContent = "Mất kết nối";
    showNotice(error.message, true);
  }
}

searchInput.addEventListener("input", renderImports);

function renderImports() {
  const query = normalize(searchInput.value);
  const visible = imports.filter((item) =>
    normalize(
      [item.listCode, item.originalFilename, item.woodSpecies].join(" ")
    ).includes(query)
  );

  const totalLogs = imports.reduce((sum, item) => sum + item.totalLogs, 0);
  const receivedLogs = imports.reduce(
    (sum, item) => sum + item.receivedLogs,
    0
  );
  const totalVolume = imports.reduce(
    (sum, item) => sum + Number(item.totalVolumeCbm || 0),
    0
  );
  summaryStrip.innerHTML = [
    summaryItem(imports.length, "File"),
    summaryItem(totalLogs, "Tổng cây"),
    summaryItem(receivedLogs, "Đã nhập kho"),
    summaryItem(formatNumber(totalVolume), "CBM")
  ].join("");

  records.innerHTML = visible.length
    ? visible.map(recordRow).join("")
    : '<div class="empty-state">Không có file phù hợp.</div>';
}

function summaryItem(value, label) {
  return `<div class="summary-item"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function recordRow(item) {
  return `
    <article class="record-row">
      <div class="record-identity">
        <span class="record-title">${escapeHtml(item.listCode)}</span>
        <span class="record-subtitle">${escapeHtml(item.originalFilename)}</span>
      </div>
      <div><span class="record-value">${escapeHtml(item.woodSpecies || "--")}</span><span class="record-label">Loại gỗ</span></div>
      <div><span class="record-value">${item.totalLogs}</span><span class="record-label">Tổng cây</span></div>
      <div><span class="record-value">${item.receivedLogs}/${item.totalLogs}</span><span class="record-label">Đã nhập</span></div>
      <div><span class="record-value">${formatNumber(item.totalVolumeCbm)}</span><span class="record-label">CBM</span></div>
    </article>
  `;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 3
  }).format(Number(value || 0));
}

function formatVolume(value) {
  return `${formatNumber(value)} CBM`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

initialize();
