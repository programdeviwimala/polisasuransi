// ==========================================
// KODE UTAMA APLIKASI (app.js)
// ==========================================

let supabaseClient;
let currentUser = null;
let currentSelectedJobId = null;
let selectedNasabahIds = []; // Untuk hapus massal

// Inisialisasi Klien supabaseClient
if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL !== "URL_SUPABASE_ANDA_DI_SINI") {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn("Kunci API supabaseClient belum terkonfigurasi di config.js.");
}

// Elemen-elemen DOM
const sectionLogin = document.getElementById("section-login");
const sectionAdmin = document.getElementById("section-admin");
const sectionInputNasabah = document.getElementById("section-input-nasabah");
const sectionLapangan = document.getElementById("section-lapangan");
const loginForm = document.getElementById("login-form");
const appHeader = document.getElementById("app-header");
const navActions = document.getElementById("nav-actions");
const modalDetail = document.getElementById("modal-detail");

// Inisialisasi Tanda Tangan Canvas
let signaturePetugas = null;
let signatureNasabah = null;

// Fungsi untuk menggambar di Canvas (Tanda Tangan)
function setupSignaturePad(canvasId, clearBtnId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    let drawing = false;

    // Menyesuaikan ukuran canvas
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#0f172a"; // Warna coretan
    }

    // Set ukuran awal & saat layar diputar
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Dapatkan posisi pointer yang benar
    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    // Event menggambar (Mouse & Touch)
    function startDrawing(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPointerPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPointerPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function stopDrawing() {
        drawing = false;
    }

    // Pasang Event Listeners
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);

    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);

    // Tombol Hapus Canvas
    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
    }

    return {
        getData: () => {
            // Cek apakah canvas kosong
            const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
            const isEmpty = !buffer.some(color => color !== 0);
            return isEmpty ? null : canvas.toDataURL("image/png");
        },
        clear: () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };
}

// Fungsi Kompresi Foto sebelum disimpan (Base64)
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const max_size = 640; // Batasan lebar/tinggi maksimal agar database enteng
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > max_size) {
                    height *= max_size / width;
                    width = max_size;
                }
            } else {
                if (height > max_size) {
                    width *= max_size / height;
                    height = max_size;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            
            // Kompresi dengan kualitas 0.6 (JPEG)
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
            callback(compressedBase64);
        };
    };
}

// Navigasi Section
function showSection(sectionId) {
    document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.add("active");
}

// Render Navigasi
function renderNavigation() {
    if (!currentUser) {
        appHeader.style.display = "none";
        return;
    }

    appHeader.style.display = "flex";
    navActions.innerHTML = "";

    const userLabel = document.createElement("span");
    userLabel.className = "nav-user";
    userLabel.innerText = `${currentUser.username} (${currentUser.role})`;
    navActions.appendChild(userLabel);

    if (currentUser.role === "admin") {
        const btnDashboard = document.createElement("button");
        btnDashboard.className = "btn btn-tab active";
        btnDashboard.innerText = "Dashboard Monitoring";
        btnDashboard.onclick = () => {
            document.querySelectorAll(".btn-tab").forEach(b => b.classList.remove("active"));
            btnDashboard.classList.add("active");
            showSection("section-admin");
            fetchDataAdmin();
        };
        navActions.appendChild(btnDashboard);

        const btnInput = document.createElement("button");
        btnInput.className = "btn btn-tab";
        btnInput.innerText = "Input Nasabah Baru";
        btnInput.onclick = () => {
            document.querySelectorAll(".btn-tab").forEach(b => b.classList.remove("active"));
            btnInput.classList.add("active");
            showSection("section-input-nasabah");
            resetFormInput();
        };
        navActions.appendChild(btnInput);

        const btnUsers = document.createElement("button");
        btnUsers.className = "btn btn-tab";
        btnUsers.innerText = "Kelola Pengguna";
        btnUsers.onclick = () => {
            document.querySelectorAll(".btn-tab").forEach(b => b.classList.remove("active"));
            btnUsers.classList.add("active");
            showSection("section-users");
            fetchUsersList();
        };
        navActions.appendChild(btnUsers);
    }

    const btnLogout = document.createElement("button");
    btnLogout.className = "btn btn-danger";
    btnLogout.innerText = "Keluar";
    btnLogout.onclick = logout;
    navActions.appendChild(btnLogout);
}

// ==========================================
// AUTHENTICATION LOGIC (LOGIN / LOGOUT)
// ==========================================
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const loginError = document.getElementById("login-error");

    if (!supabaseClient) {
        alert("Silakan sambungkan ke database supabaseClient Anda terlebih dahulu di config.js.");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("pengguna")
            .select("*")
            .eq("username", username)
            .eq("password", password)
            .maybeSingle();

        if (!data) {
            loginError.style.display = "block";
            return;
        }

        loginError.style.display = "none";
        currentUser = { username: data.username, role: data.role };
        localStorage.setItem("polistrack_session", JSON.stringify(currentUser));

        renderNavigation();
        if (currentUser.role === "admin") {
            showSection("section-admin");
            fetchDataAdmin();
            // Jalankan sinkronisasi realtime
            setupRealtimeSubscription();
        } else {
            showSection("section-lapangan");
            fetchDataLapangan();
            setupRealtimeSubscription();
        }
        
        loginForm.reset();
    } catch (err) {
        console.error(err);
        alert("Terjadi masalah koneksi database.");
    }
});

function logout() {
    currentUser = null;
    localStorage.removeItem("polistrack_session");
    renderNavigation();
    showSection("section-login");
}

function autoLogin() {
    const savedSession = localStorage.getItem("polistrack_session");
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        renderNavigation();
        if (currentUser.role === "admin") {
            showSection("section-admin");
            fetchDataAdmin();
        } else {
            showSection("section-lapangan");
            fetchDataLapangan();
        }
        setupRealtimeSubscription();
    }
}

// ==========================================
// REAL-TIME DATABASE SYNC
// ==========================================
function setupRealtimeSubscription() {
    if (!supabaseClient) return;
    
    supabaseClient
        .channel('table-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jaminan_polis' }, () => {
            if (currentUser.role === 'admin') {
                fetchDataAdmin();
            } else {
                fetchDataLapangan();
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'nasabah' }, () => {
            if (currentUser.role === 'admin') {
                fetchDataAdmin();
            } else {
                fetchDataLapangan();
            }
        })
        .subscribe();
}

// ==========================================
// ADMIN DASHBOARD & KANBAN LOGIC
// ==========================================
async function fetchDataAdmin() {
    if (!supabaseClient) return;

    try {
        // Ambil data jaminan beserta data nasabahnya
        const { data: jaminanData, error } = await supabaseClient
            .from("jaminan_polis")
            .select(`
                *,
                nasabah (
                    id,
                    nama_nasabah,
                    no_pk,
                    nama_marketing,
                    keterangan
                )
            `)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Urutkan berdasarkan angka di No PK (setelah slash kedua)
        jaminanData.sort((a, b) => {
            const pkA = extractPkNumber(a.nasabah?.no_pk || '');
            const pkB = extractPkNumber(b.nasabah?.no_pk || '');
            return pkA - pkB;
        });

        // Reset Kontainer Kartu
        const colWaiting = document.getElementById("col-waiting");
        const colArrived = document.getElementById("col-arrived");
        const colDelivery = document.getElementById("col-delivery");
        const colDone = document.getElementById("col-done");

        colWaiting.innerHTML = "";
        colArrived.innerHTML = "";
        colDelivery.innerHTML = "";
        colDone.innerHTML = "";

        let countWaiting = 0, countArrived = 0, countDelivery = 0, countDone = 0;

        // Iterasi Data & Buat Kartu
        jaminanData.forEach(item => {
            const card = document.createElement("div");
            card.className = "policy-card";
            const nasabahId = item.nasabah?.id;

            let tagClass = "tag-waiting";
            if (item.status === "Polis Datang, Menunggu Lapangan") {
                tagClass = "tag-arrived";
            } else if (item.status === "Diterima Lapangan, Dalam Proses Pengantaran") {
                tagClass = "tag-delivery";
            } else if (item.status === "Selesai, Polis Sudah Diantar Nasabah") {
                tagClass = "tag-done";
            }

            card.innerHTML = `
                <div class="card-delete-overlay">
                    <input type="checkbox" class="card-checkbox" data-nasabah-id="${nasabahId}" onclick="toggleNasabahSelect(event, '${nasabahId}')">
                </div>
                <span class="card-tag ${tagClass}">${item.status}</span>
                <div class="card-title">${item.nasabah ? item.nasabah.nama_nasabah : 'Tanpa Nama'}</div>
                <div class="card-meta">
                    <span>🚗 <strong>${item.merk_kendaraan} ${item.tipe_kendaraan}</strong></span>
                    <span>📄 PK: ${item.nasabah ? item.nasabah.no_pk : '-'}</span>
                    <span>🏢 Asuransi: ${item.asuransi_pilihan}</span>
                    ${item.petugas_lapangan ? `<span>👤 Kurir: ${item.petugas_lapangan}</span>` : ''}
                </div>
                <button class="btn-delete-card" onclick="konfirmasiHapusNasabah(event, '${nasabahId}', '${item.nasabah?.nama_nasabah || 'Nasabah'}', '${item.nasabah?.no_pk || ''}')" title="Hapus nasabah ini">🗑️</button>
            `;

            // Klik kartu (bukan tombol hapus) untuk buka modal
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-delete-card') || e.target.classList.contains('card-checkbox')) return;
                openDetailModal(item);
            });

            // Masukkan ke kolom yang sesuai
            if (item.status === "Menunggu Polis") {
                colWaiting.appendChild(card);
                countWaiting++;
            } else if (item.status === "Polis Datang, Menunggu Lapangan") {
                colArrived.appendChild(card);
                countArrived++;
            } else if (item.status === "Diterima Lapangan, Dalam Proses Pengantaran") {
                colDelivery.appendChild(card);
                countDelivery++;
            } else if (item.status === "Selesai, Polis Sudah Diantar Nasabah") {
                colDone.appendChild(card);
                countDone++;
            }
        });

        // Update Counter Box
        document.getElementById("count-waiting").innerText = countWaiting;
        document.getElementById("count-arrived").innerText = countArrived;
        document.getElementById("count-delivery").innerText = countDelivery;
        document.getElementById("count-done").innerText = countDone;

        // Update Column Badges
        document.getElementById("badge-waiting").innerText = countWaiting;
        document.getElementById("badge-arrived").innerText = countArrived;
        document.getElementById("badge-delivery").innerText = countDelivery;
        document.getElementById("badge-done").innerText = countDone;

        // Reset state pilihan hapus massal
        selectedNasabahIds = [];
        updateDeleteToolbar();

    } catch (err) {
        console.error("Gagal memuat data admin:", err);
    }
}

// ==========================================
// INPUT DATA NASABAH (ADMIN)
// ==========================================
const btnAddJaminan = document.getElementById("btn-add-jaminan");
const jaminanContainer = document.getElementById("jaminan-items-container");
let jaminanIndexCount = 0;

// Tambah form input jaminan dinamis
btnAddJaminan.addEventListener("click", () => {
    jaminanIndexCount++;
    const itemBox = document.createElement("div");
    itemBox.className = "jaminan-item-box";
    itemBox.setAttribute("data-index", jaminanIndexCount);
    
    itemBox.innerHTML = `
        <button type="button" class="btn-remove-item" onclick="removeJaminanItem(${jaminanIndexCount})">&times;</button>
        <div class="grid-3">
            <div class="form-group">
                <label>Merk Kendaraan</label>
                <input type="text" class="form-control jaminan-merk" required placeholder="Contoh: Toyota">
            </div>
            <div class="form-group">
                <label>Tipe Kendaraan</label>
                <input type="text" class="form-control jaminan-tipe" required placeholder="Contoh: Avanza G Veloz">
            </div>
            <div class="form-group">
                <label>Tahun Kendaraan</label>
                <input type="number" class="form-control jaminan-tahun" required placeholder="Tahun">
            </div>
        </div>
        <div class="grid-2">
            <div class="form-group">
                <label>Harga Taksasi (Rp)</label>
                <input type="number" class="form-control jaminan-taksasi" required placeholder="Taksiran harga">
            </div>
            <div class="form-group">
                <label>Asuransi Pilihan</label>
                <select class="form-control jaminan-asuransi" required>
                    <option value="MAG">MAG</option>
                    <option value="CHUBB">CHUBB</option>
                    <option value="Ramayana">Ramayana</option>
                    <option value="Allianz">Allianz</option>
                    <option value="Lainnya">Lainnya</option>
                </select>
            </div>
        </div>
    `;
    jaminanContainer.appendChild(itemBox);
});

window.removeJaminanItem = function(index) {
    const item = document.querySelector(`.jaminan-item-box[data-index="${index}"]`);
    if (item) item.remove();
};

function resetFormInput() {
    document.getElementById("nasabah-form").reset();
    jaminanContainer.innerHTML = `
        <div class="jaminan-item-box" data-index="0">
            <div class="grid-3">
                <div class="form-group">
                    <label>Merk Kendaraan</label>
                    <input type="text" class="form-control jaminan-merk" required placeholder="Contoh: Toyota">
                </div>
                <div class="form-group">
                    <label>Tipe Kendaraan</label>
                    <input type="text" class="form-control jaminan-tipe" required placeholder="Contoh: Avanza G Veloz">
                </div>
                <div class="form-group">
                    <label>Tahun Kendaraan</label>
                    <input type="number" class="form-control jaminan-tahun" required placeholder="Tahun">
                </div>
            </div>
            <div class="grid-2">
                <div class="form-group">
                    <label>Harga Taksasi (Rp)</label>
                    <input type="number" class="form-control jaminan-taksasi" required placeholder="Taksiran harga">
                </div>
                <div class="form-group">
                    <label>Asuransi Pilihan</label>
                    <select class="form-control jaminan-asuransi" required>
                        <option value="MAG">MAG</option>
                        <option value="CHUBB">CHUBB</option>
                        <option value="Ramayana">Ramayana</option>
                        <option value="Allianz">Allianz</option>
                        <option value="Lainnya">Lainnya</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    jaminanIndexCount = 0;
}

document.getElementById("btn-cancel-input").onclick = () => {
    document.querySelectorAll(".btn-tab").forEach(b => b.classList.remove("active"));
    const btnDashboard = document.querySelector(".btn-tab");
    if (btnDashboard) btnDashboard.classList.add("active");
    showSection("section-admin");
    fetchDataAdmin();
};

// Proses Simpan Data Form Input Nasabah + Multi Jaminan
document.getElementById("nasabah-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    try {
        // 1. Simpan Data Nasabah Terlebih Dahulu
        const nNama = document.getElementById("nasabah-nama").value.trim();
        const nMarketing = document.getElementById("nasabah-marketing").value.trim();
        const nPk = document.getElementById("nasabah-pk").value.trim();
        const nPlafond = document.getElementById("nasabah-plafond").value;
        const nJangka = document.getElementById("nasabah-jangka").value;
        const nAwal = document.getElementById("nasabah-awal").value;
        const nAkhir = document.getElementById("nasabah-akhir").value;
        const nBunga = document.getElementById("nasabah-bunga").value;
        const nKet = document.getElementById("nasabah-keterangan").value;

        // --- CEK DUPLIKAT NO PK ---
        const { data: existing } = await supabaseClient
            .from("nasabah")
            .select("id")
            .eq("no_pk", nPk)
            .maybeSingle();

        if (existing) {
            alert(`⚠️ No PK "${nPk}" sudah terdaftar!\n\nGunakan fitur Pencarian di Dashboard untuk melihat data nasabah tersebut.`);
            return;
        }
        // --- AKHIR CEK DUPLIKAT ---

        const { data: nasabahSaved, error: nasabahError } = await supabaseClient
            .from("nasabah")
            .insert({
                nama_nasabah: nNama,
                nama_marketing: nMarketing,
                no_pk: nPk,
                plafond: nPlafond,
                jangka_waktu: nJangka,
                periode_awal: nAwal,
                periode_akhir: nAkhir,
                bunga: nBunga,
                keterangan: nKet
            })
            .select()
            .single();

        if (nasabahError) throw nasabahError;

        // 2. Kumpulkan Semua Data Jaminan dari Form
        const items = document.querySelectorAll(".jaminan-item-box");
        const jaminanToInsert = [];

        items.forEach(box => {
            const jMerk = box.querySelector(".jaminan-merk").value.trim();
            const jTipe = box.querySelector(".jaminan-tipe").value.trim();
            const jTahun = box.querySelector(".jaminan-tahun").value;
            const jTaksasi = box.querySelector(".jaminan-taksasi").value;
            const jAsuransi = box.querySelector(".jaminan-asuransi").value;

            jaminanToInsert.push({
                nasabah_id: nasabahSaved.id,
                merk_kendaraan: jMerk,
                tipe_kendaraan: jTipe,
                tahun_kendaraan: jTahun,
                harga_taksasi: jTaksasi,
                asuransi_pilihan: jAsuransi,
                status: "Menunggu Polis"
            });
        });

        // 3. Simpan Seluruh Jaminan
        const { error: jaminanError } = await supabaseClient
            .from("jaminan_polis")
            .insert(jaminanToInsert);

        if (jaminanError) throw jaminanError;

        alert("✅ Data Nasabah & Jaminan berhasil disimpan!");
        resetFormInput();
        
        // Pindah kembali ke Dashboard
        document.querySelectorAll(".btn-tab").forEach(b => b.classList.remove("active"));
        const btnDashboard = document.querySelector(".btn-tab");
        if (btnDashboard) btnDashboard.classList.add("active");
        showSection("section-admin");
        fetchDataAdmin();

    } catch (err) {
        console.error("Gagal simpan data nasabah:", err);
        alert(`Gagal menyimpan data: ${err.message || err.details}`);
    }
});

// ==========================================
// LAPANGAN (KURIR) VIEW LOGIC
// ==========================================
async function fetchDataLapangan() {
    if (!supabaseClient || !currentUser) return;

    try {
        const { data: jobData, error } = await supabaseClient
            .from("jaminan_polis")
            .select(`
                *,
                nasabah (
                    nama_nasabah,
                    no_pk,
                    nama_marketing,
                    keterangan
                )
            `)
            .eq("petugas_lapangan", currentUser.username)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        const listContainer = document.getElementById("lapangan-list");
        const emptyState = document.getElementById("lapangan-empty-state");

        listContainer.innerHTML = "";

        if (jobData.length === 0) {
            emptyState.style.display = "block";
            return;
        }

        emptyState.style.display = "none";

        jobData.forEach(job => {
            const card = document.createElement("div");
            card.className = "policy-card";
            card.onclick = () => openDetailModal(job);

            let tagClass = "tag-delivery";
            if (job.status === "Selesai, Polis Sudah Diantar Nasabah") {
                tagClass = "tag-done";
            }

            card.innerHTML = `
                <span class="card-tag ${tagClass}">${job.status}</span>
                <div class="card-title">${job.nasabah ? job.nasabah.nama_nasabah : 'Tanpa Nama'}</div>
                <div class="card-meta">
                    <span>🚗 <strong>${job.merk_kendaraan} ${job.tipe_kendaraan}</strong></span>
                    <span>🏢 Asuransi: ${job.asuransi_pilihan}</span>
                    <span>📄 No Polis: ${job.no_polis || '-'}</span>
                </div>
            `;
            listContainer.appendChild(card);
        });

    } catch (err) {
        console.error("Gagal memuat tugas petugas lapangan:", err);
    }
}

// ==========================================
// MODAL POPUP & UPDATE STATUS PROCESS
// ==========================================
async function openDetailModal(item) {
    currentSelectedJobId = item.id;
    currentModalItem = item; // Simpan untuk keperluan print
    
    // Tampilkan Informasi
    document.getElementById("det-nasabah-nama").innerText = item.nasabah ? item.nasabah.nama_nasabah : "-";
    document.getElementById("det-nasabah-pk").innerText = item.nasabah ? item.nasabah.no_pk : "-";
    document.getElementById("det-nasabah-marketing").innerText = item.nasabah ? item.nasabah.nama_marketing : "-";
    document.getElementById("det-nasabah-ket").innerText = item.nasabah ? item.nasabah.keterangan : "-";

    document.getElementById("det-jaminan-mobil").innerText = `${item.merk_kendaraan} ${item.tipe_kendaraan} (${item.tahun_kendaraan})`;
    document.getElementById("det-jaminan-asuransi").innerText = item.asuransi_pilihan;
    document.getElementById("det-jaminan-status").innerText = item.status;
    document.getElementById("det-jaminan-polis-no").innerText = item.no_polis || "Belum Dibuat";

    // Pengaturan Panel Aksi Sesuai Status & Role
    const actAdminArrived = document.getElementById("action-admin-arrived");
    const actAdminAssign = document.getElementById("action-admin-assign");
    const actLapanganDone = document.getElementById("action-lapangan-done");
    const actCompletedInfo = document.getElementById("action-completed-info");
    const printPanel = document.getElementById("print-panel");
    const btnPrintPetugas = document.getElementById("btn-print-ttd-petugas");
    const btnPrintNasabah = document.getElementById("btn-print-ttd-nasabah");

    actAdminArrived.style.display = "none";
    actAdminAssign.style.display = "none";
    actLapanganDone.style.display = "none";
    actCompletedInfo.style.display = "none";
    
    // Reset panel cetak
    printPanel.style.display = "none";
    btnPrintPetugas.style.display = "none";
    btnPrintNasabah.style.display = "none";

    if (item.status === "Menunggu Polis") {
        if (currentUser.role === "admin") {
            actAdminArrived.style.display = "block";
            document.getElementById("input-no-polis").value = "";
        }
    } 
    
    else if (item.status === "Polis Datang, Menunggu Lapangan") {
        if (currentUser.role === "admin") {
            actAdminAssign.style.display = "block";
            
            // Muat daftar petugas lapangan di dropdown
            const selectPetugas = document.getElementById("select-petugas");
            selectPetugas.innerHTML = "";
            const { data: listPetugas } = await supabaseClient
                .from("pengguna")
                .select("username")
                .eq("role", "lapangan");
            
            if (listPetugas) {
                listPetugas.forEach(p => {
                    const opt = document.createElement("option");
                    opt.value = p.username;
                    opt.innerText = p.username;
                    selectPetugas.appendChild(opt);
                });
            }

            // Setup Tanda Tangan Serah Terima Petugas Lapangan
            setTimeout(() => {
                signaturePetugas = setupSignaturePad("canvas-ttd-petugas", "btn-clear-ttd-petugas");
            }, 100);
        }
    } 
    
    else if (item.status === "Diterima Lapangan, Dalam Proses Pengantaran") {
        if (currentUser.role === "lapangan") {
            actLapanganDone.style.display = "block";
            
            // Reset input file & foto preview
            document.getElementById("input-camera-foto").value = "";
            const imgPreview = document.getElementById("preview-foto-bukti");
            imgPreview.src = "";
            imgPreview.style.display = "none";

            // Setup Tanda Tangan Penerimaan Nasabah
            setTimeout(() => {
                signatureNasabah = setupSignaturePad("canvas-ttd-nasabah", "btn-clear-ttd-nasabah");
            }, 100);
        }
        // Menu cetak tanda terima petugas tersedia
        printPanel.style.display = "block";
        btnPrintPetugas.style.display = "block";
    } 
    
    else if (item.status === "Selesai, Polis Sudah Diantar Nasabah") {
        actCompletedInfo.style.display = "block";
        document.getElementById("img-ttd-petugas").src = item.ttd_petugas || "";
        document.getElementById("img-ttd-nasabah").src = item.ttd_nasabah || "";
        document.getElementById("img-foto-bukti").src = item.foto_bukti || "";
        
        // Menu cetak tanda terima petugas & nasabah tersedia
        printPanel.style.display = "block";
        btnPrintPetugas.style.display = "block";
        btnPrintNasabah.style.display = "block";
        const btnKirimWa = document.getElementById("btn-kirim-wa");
        if (btnKirimWa) btnKirimWa.style.display = "block";
        const btnSharePdf = document.getElementById("btn-share-pdf");
        if (btnSharePdf) btnSharePdf.style.display = "block";
    }

    modalDetail.classList.add("active");
}

// Tutup Modal
document.getElementById("btn-close-modal").onclick = () => {
    modalDetail.classList.remove("active");
    currentSelectedJobId = null;
};

// AKSI ADMIN 1: Polis Datang (Menunggu -> Datang)
document.getElementById("btn-admin-submit-arrived").addEventListener("click", async () => {
    const noPolis = document.getElementById("input-no-polis").value.trim();
    if (!noPolis) {
        alert("Harap masukkan Nomor Polis Asuransi.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("jaminan_polis")
            .update({
                no_polis: noPolis,
                status: "Polis Datang, Menunggu Lapangan",
                updated_at: new Date()
            })
            .eq("id", currentSelectedJobId);

        if (error) throw error;

        modalDetail.classList.remove("active");
        fetchDataAdmin();
        alert("Nomor Polis berhasil disimpan. Status berubah ke 'Polis Datang'!");
    } catch (err) {
        alert("Gagal update data: " + err.message);
    }
});

// AKSI ADMIN 2: Serahkan ke Petugas Lapangan (Datang -> Pengantaran)
document.getElementById("btn-admin-submit-assign").addEventListener("click", async () => {
    const namaPetugas = document.getElementById("select-petugas").value;
    const ttdData = signaturePetugas ? signaturePetugas.getData() : null;

    if (!ttdData) {
        alert("Petugas lapangan harus menandatangani tanda terima serah-terima fisik.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("jaminan_polis")
            .update({
                petugas_lapangan: namaPetugas,
                ttd_petugas: ttdData,
                status: "Diterima Lapangan, Dalam Proses Pengantaran",
                updated_at: new Date()
            })
            .eq("id", currentSelectedJobId);

        if (error) throw error;

        modalDetail.classList.remove("active");
        fetchDataAdmin();
        alert(`Fisik polis telah diserahkan ke ${namaPetugas} untuk diantarkan.`);
    } catch (err) {
        alert("Gagal menyerahkan polis: " + err.message);
    }
});

// Penanganan Unggah Foto Bukti
const cameraClickBox = document.getElementById("camera-click-box");
const inputCameraFoto = document.getElementById("input-camera-foto");
const previewFotoBukti = document.getElementById("preview-foto-bukti");
let base64FotoBukti = null;

cameraClickBox.addEventListener("click", (e) => {
    if (e.target !== inputCameraFoto) {
        inputCameraFoto.click();
    }
});

inputCameraFoto.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        compressImage(file, (base64Result) => {
            base64FotoBukti = base64Result;
            previewFotoBukti.src = base64Result;
            previewFotoBukti.style.display = "block";
        });
    }
});

// AKSI LAPANGAN: Selesaikan Pengantaran (Pengantaran -> Selesai)
document.getElementById("btn-lapangan-submit-done").addEventListener("click", async () => {
    const ttdDataNasabah = signatureNasabah ? signatureNasabah.getData() : null;

    if (!base64FotoBukti) {
        alert("Harap ambil/unggah foto bukti tanda terima dengan nasabah.");
        return;
    }
    if (!ttdDataNasabah) {
        alert("Harap minta nasabah menandatangani layar HP.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("jaminan_polis")
            .update({
                ttd_nasabah: ttdDataNasabah,
                foto_bukti: base64FotoBukti,
                status: "Selesai, Polis Sudah Diantar Nasabah",
                updated_at: new Date()
            })
            .eq("id", currentSelectedJobId);

        if (error) throw error;

        modalDetail.classList.remove("active");
        fetchDataLapangan();
        alert("Selamat! Tugas pengantaran Anda telah diselesaikan.");
    } catch (err) {
        alert("Gagal menyelesaikan tugas: " + err.message);
    }
});

// Cek Sesi saat Halaman Dimuat
window.addEventListener("DOMContentLoaded", () => {
    autoLogin();
    setupSearch();
    setupPrintButtons();
    setupUserManagement();
    setupExcelImport();
});

// ==========================================
// FITUR PENCARIAN REAL-TIME
// ==========================================
let allJaminanData = []; // Menyimpan semua data untuk pencarian

function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const btnClearSearch = document.getElementById("btn-clear-search");
    const searchResultsInfo = document.getElementById("search-results-info");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const keyword = searchInput.value.trim().toLowerCase();

        if (keyword.length === 0) {
            // Reset: tampilkan semua kartu
            document.querySelectorAll(".policy-card").forEach(card => {
                card.classList.remove("search-hidden", "search-match");
            });
            btnClearSearch.style.display = "none";
            searchResultsInfo.style.display = "none";
            return;
        }

        btnClearSearch.style.display = "block";

        let matchCount = 0;

        // Filter kartu berdasarkan keyword
        document.querySelectorAll(".policy-card").forEach(card => {
            const cardText = card.innerText.toLowerCase();
            if (cardText.includes(keyword)) {
                card.classList.remove("search-hidden");
                card.classList.add("search-match");
                matchCount++;
            } else {
                card.classList.add("search-hidden");
                card.classList.remove("search-match");
            }
        });

        searchResultsInfo.style.display = "block";
        searchResultsInfo.innerHTML = matchCount > 0
            ? `🔍 Ditemukan <strong>${matchCount}</strong> hasil untuk kata kunci "<em>${searchInput.value}</em>"`
            : `🔍 Tidak ada hasil untuk kata kunci "<em>${searchInput.value}</em>"`;
    });

    btnClearSearch.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
        searchInput.focus();
    });
}

// ==========================================
// FITUR PRINT TANDA TERIMA
// ==========================================

// Menyimpan data item yang sedang dibuka di modal
let currentModalItem = null;

// Override openDetailModal untuk menyimpan data saat ini
const _originalOpenDetailModal = openDetailModal;
window.openDetailModal_withPrint = async function(item) {
    currentModalItem = item;
    await openDetailModal(item);
};

function setupPrintButtons() {
    const btnPrintPetugas = document.getElementById("btn-print-ttd-petugas");
    const btnPrintNasabah = document.getElementById("btn-print-ttd-nasabah");
    const btnKirimWa = document.getElementById("btn-kirim-wa");

    if (btnPrintPetugas) {
        btnPrintPetugas.addEventListener("click", () => {
            if (!currentModalItem) return;
            printTandaTerima("petugas", currentModalItem);
        });
    }

    if (btnPrintNasabah) {
        btnPrintNasabah.addEventListener("click", () => {
            if (!currentModalItem) return;
            printTandaTerima("nasabah", currentModalItem);
        });
    }

    if (btnKirimWa) {
        btnKirimWa.addEventListener("click", async () => {
            if (!currentModalItem) return;
            await kirimWhatsApp(currentModalItem);
        });
    }

    const btnSharePdf = document.getElementById("btn-share-pdf");
    if (btnSharePdf) {
        btnSharePdf.addEventListener("click", async () => {
            if (!currentModalItem) return;
            await sharePdfTandaTerima(currentModalItem);
        });
    }
}

function formatTanggal(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const options = { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" };
    return d.toLocaleDateString("id-ID", options);
}

function formatRupiah(angka) {
    if (!angka) return "-";
    return "Rp " + parseFloat(angka).toLocaleString("id-ID");
}

async function printTandaTerima(jenis, item) {
    const printArea = document.getElementById("print-area");
    if (!printArea) return;

    const nasabah = item.nasabah || {};
    const tanggalCetak = new Date().toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    if (jenis === "petugas") {
        // ===========================================
        // TANDA TERIMA SERAH TERIMA KE PETUGAS LAPANGAN
        // ===========================================
        printArea.innerHTML = `
            <div class="print-header">
                <h1>Tanda Terima Polis Asuransi</h1>
                <p>Serah Terima dari Admin ke Petugas Lapangan</p>
            </div>

            <div class="print-title">Bukti Serah Terima Fisik Polis</div>

            <table class="print-table">
                <tr><td>Nama Petugas Lapangan</td><td>${item.petugas_lapangan || "-"}</td></tr>
                <tr><td>No. PK (Perjanjian Kredit)</td><td>${nasabah.no_pk || "-"}</td></tr>
                <tr><td>Tanggal Pencairan</td><td>${formatTanggal(nasabah.created_at)}</td></tr>
                <tr><td>Nama Nasabah</td><td>${nasabah.nama_nasabah || "-"}</td></tr>
                <tr><td>Perusahaan Asuransi</td><td>${item.asuransi_pilihan}</td></tr>
                <tr><td>Nomor Polis Asuransi</td><td>${item.no_polis || "-"}</td></tr>
                <tr><td>Tanggal Terima Petugas</td><td>${formatTanggal(item.updated_at)}</td></tr>
            </table>

            <p style="font-size:12px; color:#64748b; margin-top:16px; margin-bottom:16px;">
                Dengan ini menyatakan bahwa Fisik Polis Asuransi di atas telah diserahterimakan dari Admin Kantor ke Petugas Lapangan untuk didistribusikan ke Nasabah.
            </p>

            <div class="print-signature-section">
                <div class="print-signature-box">
                    <div class="label">Yang Menyerahkan</div>
                    <div class="label" style="font-size:11px; color:#64748b; margin-bottom:4px;">(Admin Kantor)</div>
                    <div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc;"></div>
                    <div class="signer-name">Admin</div>
                </div>
                <div class="print-signature-box">
                    <div class="label">Yang Menerima</div>
                    <div class="label" style="font-size:11px; color:#64748b; margin-bottom:4px;">(Petugas Lapangan)</div>
                    ${item.ttd_petugas
                        ? `<img src="${item.ttd_petugas}" alt="Tanda Tangan Petugas">`
                        : `<div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc;"></div>`
                    }
                    <div class="signer-name">${item.petugas_lapangan || "_______________"}</div>
                </div>
            </div>

            <div class="print-footer">
                Dicetak pada: ${tanggalCetak} &nbsp;|&nbsp; Sistem Monitoring Polis Asuransi
            </div>
        `;

    } else if (jenis === "nasabah") {
        // Fetch all jaminan vehicles for this customer
        let allJaminan = [];
        try {
            const { data } = await supabaseClient
                .from("jaminan_polis")
                .select("*")
                .eq("nasabah_id", item.nasabah_id);
            if (data) allJaminan = data;
        } catch (err) {
            console.error("Gagal mengambil data jaminan untuk print:", err);
        }

        let jaminanRowsHtml = '';
        allJaminan.forEach((j, index) => {
            jaminanRowsHtml += `
                <tr>
                    <td style="text-align: center; border: 1px solid #e2e8f0; padding: 6px; font-weight: normal; background: none;">${index + 1}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight:600;">${j.merk_kendaraan}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">${j.tipe_kendaraan}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px; text-align:center;">${j.tahun_kendaraan}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px; text-align:right;">${formatRupiah(j.harga_taksasi)}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px; text-align:center;">${j.asuransi_pilihan}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">${j.no_polis || "-"}</td>
                </tr>
            `;
        });

        // ===========================================
        // TANDA TERIMA PENERIMAAN OLEH NASABAH
        // ===========================================
        printArea.innerHTML = `
            <div class="print-header">
                <h1>Tanda Terima Polis Asuransi</h1>
                <p>Bukti Penerimaan Polis oleh Nasabah</p>
            </div>

            <div class="print-title">Bukti Penerimaan Polis oleh Nasabah</div>

            <table class="print-table" style="margin-bottom: 12px;">
                <tr><td>Nama Nasabah</td><td>${nasabah.nama_nasabah || "-"}</td></tr>
                <tr><td>No. PK (Perjanjian Kredit)</td><td>${nasabah.no_pk || "-"}</td></tr>
                <tr><td>Tanggal Terima Nasabah</td><td>${formatTanggal(item.updated_at)}</td></tr>
            </table>

            <h4 style="margin: 16px 0 6px 0; font-size:12px; text-transform:uppercase; color:#475569;">Daftar Jaminan Kendaraan:</h4>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size:12px;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:center; width:5%; background: #f1f5f9;">No</th>
                        <th style="border: 1px solid #e2e8f0; padding: 6px; background: #f1f5f9;">Merk</th>
                        <th style="border: 1px solid #e2e8f0; padding: 6px; background: #f1f5f9;">Tipe</th>
                        <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:center; width:10%; background: #f1f5f9;">Tahun</th>
                        <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:right; background: #f1f5f9;">Harga Taksasi</th>
                        <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:center; background: #f1f5f9;">Asuransi</th>
                        <th style="border: 1px solid #e2e8f0; padding: 6px; background: #f1f5f9;">No. Polis</th>
                    </tr>
                </thead>
                <tbody>
                    ${jaminanRowsHtml}
                </tbody>
            </table>

            ${item.foto_bukti ? `
                <div style="margin-bottom:20px; text-align:center;">
                    <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:#64748b; margin-bottom:8px;">Foto Bukti Tanda Terima (Nasabah Menerima Polis)</div>
                    <img src="${item.foto_bukti}" alt="Foto Bukti" style="max-width:280px; max-height:180px; border:1px solid #e2e8f0; border-radius:6px; object-fit:cover;">
                </div>
            ` : ""}

            <div class="print-signature-section" style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                <div class="print-signature-box">
                    <div class="label">Admin Kantor</div>
                    <div class="label" style="font-size:10px; color:#64748b; margin-bottom:4px;">(Tanda Tangan Manual)</div>
                    <div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-style:italic; font-size:11px;">Tanda Tangan</div>
                    <div class="signer-name">${currentUser ? currentUser.username : "Admin"}</div>
                </div>
                <div class="print-signature-box">
                    <div class="label">Petugas Lapangan</div>
                    <div class="label" style="font-size:10px; color:#64748b; margin-bottom:4px;">(Digital/Otomatis)</div>
                    ${item.ttd_petugas
                        ? `<img src="${item.ttd_petugas}" alt="Tanda Tangan Petugas">`
                        : `<div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-style:italic; font-size:11px;">Belum TTD</div>`
                    }
                    <div class="signer-name">${item.petugas_lapangan || "Petugas Lapangan"}</div>
                </div>
                <div class="print-signature-box">
                    <div class="label">Penerima (Nasabah)</div>
                    <div class="label" style="font-size:10px; color:#64748b; margin-bottom:4px;">(Digital/Otomatis)</div>
                    ${item.ttd_nasabah
                        ? `<img src="${item.ttd_nasabah}" alt="Tanda Tangan Nasabah">`
                        : `<div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-style:italic; font-size:11px;">Belum TTD</div>`
                    }
                    <div class="signer-name">${nasabah.nama_nasabah || "_______________"}</div>
                </div>
            </div>

            <div class="print-footer">
                Dicetak pada: ${tanggalCetak} &nbsp;|&nbsp; Sistem Monitoring Polis Asuransi
            </div>
        `;
    }

    // Jalankan dialog print browser
    window.print();
}

// ==========================================
// FUNGSI EXPORT & SHARE PDF (HP / LAPANGAN)
// ==========================================
async function sharePdfTandaTerima(item) {
    const printArea = document.getElementById("print-area");
    if (!printArea) return;

    // Tampilkan loading alert
    const btnShare = document.getElementById("btn-share-pdf");
    const originalText = btnShare.innerHTML;
    btnShare.disabled = true;
    btnShare.innerHTML = "⏳ Menyiapkan PDF...";

    const nasabah = item.nasabah || {};
    
    // 1. Ambil data jaminan untuk di-render di HTML printArea (agar identik)
    let allJaminan = [];
    try {
        const { data } = await supabaseClient
            .from("jaminan_polis")
            .select("*")
            .eq("nasabah_id", item.nasabah_id);
        if (data) allJaminan = data;
    } catch (err) {
        console.error("Gagal ambil jaminan:", err);
    }

    let jaminanRowsHtml = '';
    allJaminan.forEach((j, index) => {
        jaminanRowsHtml += `
            <tr>
                <td style="text-align: center; border: 1px solid #e2e8f0; padding: 6px; font-weight: normal; background: none;">${index + 1}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight:600;">${j.merk_kendaraan}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${j.tipe_kendaraan}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; text-align:center;">${j.tahun_kendaraan}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; text-align:right;">${formatRupiah(j.harga_taksasi)}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; text-align:center;">${j.asuransi_pilihan}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${j.no_polis || "-"}</td>
            </tr>
        `;
    });

    const tanggalCetak = new Date().toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    // Render HTML Tanda Terima Nasabah ke Print Area
    printArea.innerHTML = `
        <div class="print-header">
            <h1>Tanda Terima Polis Asuransi</h1>
            <p>Bukti Penerimaan Polis oleh Nasabah</p>
        </div>

        <div class="print-title">Bukti Penerimaan Polis oleh Nasabah</div>

        <table class="print-table" style="margin-bottom: 12px;">
            <tr><td>Nama Nasabah</td><td>${nasabah.nama_nasabah || "-"}</td></tr>
            <tr><td>No. PK (Perjanjian Kredit)</td><td>${nasabah.no_pk || "-"}</td></tr>
            <tr><td>Tanggal Terima Nasabah</td><td>${formatTanggal(item.updated_at)}</td></tr>
        </table>

        <h4 style="margin: 16px 0 6px 0; font-size:12px; text-transform:uppercase; color:#475569;">Daftar Jaminan Kendaraan:</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size:12px;">
            <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                    <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:center; width:5%; background: #f1f5f9;">No</th>
                    <th style="border: 1px solid #e2e8f0; padding: 6px; background: #f1f5f9;">Merk</th>
                    <th style="border: 1px solid #e2e8f0; padding: 6px; background: #f1f5f9;">Tipe</th>
                    <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:center; width:10%; background: #f1f5f9;">Tahun</th>
                    <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:right; background: #f1f5f9;">Harga Taksasi</th>
                    <th style="border: 1px solid #e2e8f0; padding: 6px; text-align:center; background: #f1f5f9;">Asuransi</th>
                    <th style="border: 1px solid #e2e8f0; padding: 6px; background: #f1f5f9;">No. Polis</th>
                </tr>
            </thead>
            <tbody>
                ${jaminanRowsHtml}
            </tbody>
        </table>

        ${item.foto_bukti ? `
            <div style="margin-bottom:20px; text-align:center;">
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:#64748b; margin-bottom:8px;">Foto Bukti Tanda Terima (Nasabah Menerima Polis)</div>
                <img src="${item.foto_bukti}" alt="Foto Bukti" style="max-width:280px; max-height:180px; border:1px solid #e2e8f0; border-radius:6px; object-fit:cover;">
            </div>
        ` : ""}

        <div class="print-signature-section" style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div class="print-signature-box">
                <div class="label">Admin Kantor</div>
                <div class="label" style="font-size:10px; color:#64748b; margin-bottom:4px;">(Tanda Tangan Manual)</div>
                <div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-style:italic; font-size:11px;">Tanda Tangan</div>
                <div class="signer-name">Admin</div>
            </div>
            <div class="print-signature-box">
                <div class="label">Petugas Lapangan</div>
                <div class="label" style="font-size:10px; color:#64748b; margin-bottom:4px;">(Digital/Otomatis)</div>
                ${item.ttd_petugas
                    ? `<img src="${item.ttd_petugas}" alt="Tanda Tangan Petugas">`
                    : `<div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-style:italic; font-size:11px;">Belum TTD</div>`
                }
                <div class="signer-name">${item.petugas_lapangan || "Petugas Lapangan"}</div>
            </div>
            <div class="print-signature-box">
                <div class="label">Penerima (Nasabah)</div>
                <div class="label" style="font-size:10px; color:#64748b; margin-bottom:4px;">(Digital/Otomatis)</div>
                ${item.ttd_nasabah
                    ? `<img src="${item.ttd_nasabah}" alt="Tanda Tangan Nasabah">`
                    : `<div style="height: 90px; border: 1px solid #e2e8f0; border-radius:4px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-style:italic; font-size:11px;">Belum TTD</div>`
                }
                <div class="signer-name">${nasabah.nama_nasabah || "_______________"}</div>
            </div>
        </div>

        <div class="print-footer" style="margin-top:20px;">
            Dicetak pada: ${tanggalCetak} &nbsp;|&nbsp; Sistem Monitoring Polis Asuransi
        </div>
    `;

    // TAMPILKAN LOADING OVERLAY DI LAYAR UTAMA (USER TIDAK AKAN MELIHAT PROSES RENDERING DI BELAKANGNYA)
    const style = document.createElement('style');
    style.id = "pdf-spin-style";
    style.innerHTML = `
        @keyframes pdf-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    const loadingOverlay = document.createElement("div");
    loadingOverlay.style.position = "fixed";
    loadingOverlay.style.top = "0";
    loadingOverlay.style.left = "0";
    loadingOverlay.style.width = "100vw";
    loadingOverlay.style.height = "100vh";
    loadingOverlay.style.background = "rgba(15, 23, 42, 0.95)"; // Slate gelap solid
    loadingOverlay.style.zIndex = "99999";
    loadingOverlay.style.display = "flex";
    loadingOverlay.style.flexDirection = "column";
    loadingOverlay.style.alignItems = "center";
    loadingOverlay.style.justifyContent = "center";
    loadingOverlay.style.color = "#ffffff";
    loadingOverlay.style.fontFamily = "'Outfit', sans-serif";
    loadingOverlay.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 20px; animation: pdf-spin 1.5s linear infinite; display: inline-block;">⏳</div>
        <div style="font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">Menyiapkan PDF Tanda Terima...</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 8px;">Mohon tunggu sebentar, file sedang diproses.</div>
    `;
    document.body.appendChild(loadingOverlay);

    // BUAT KONTAINER SEMENTARA DI BAWAH LOADING OVERLAY (DAPAT DI-RENDER BROWSER TAPI TERTUTUP OVERLAY)
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "0";
    tempContainer.style.top = "0";
    tempContainer.style.width = "794px"; // Lebar kertas A4 standar
    tempContainer.style.zIndex = "99998"; // Di bawah loading overlay
    tempContainer.style.background = "#ffffff";
    tempContainer.style.padding = "40px";
    tempContainer.style.boxSizing = "border-box";
    tempContainer.style.fontFamily = "'Plus Jakarta Sans', Arial, sans-serif";
    tempContainer.style.color = "#1e293b";
    
    // Salin seluruh HTML tanda terima dari printArea ke kontainer sementara
    tempContainer.innerHTML = printArea.innerHTML;
    document.body.appendChild(tempContainer);

    // Beri waktu 300ms agar browser merender & menyusun layout elemen di background
    await new Promise(resolve => setTimeout(resolve, 350));

    // Konfigurasi html2pdf dengan penyesuaian ukuran canvas & scroll bypass untuk HP
    const opt = {
        margin:       10,
        filename:     `Tanda_Terima_${nasabah.nama_nasabah || 'Nasabah'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 1, // Turunkan ke 1 agar tidak crash memori kanvas pada browser HP (menghindari PDF kosong)
            useCORS: true, 
            logging: false,
            width: 794,
            height: tempContainer.scrollHeight,
            windowWidth: 794,
            windowHeight: tempContainer.scrollHeight,
            scrollX: 0,
            scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        const blob = await html2pdf().from(tempContainer).set(opt).output('blob');
        
        // Bersihkan DOM (Hapus overlay dan kontainer)
        if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
        if (document.body.contains(loadingOverlay)) document.body.removeChild(loadingOverlay);
        if (document.head.contains(style)) document.head.removeChild(style);

        const file = new File([blob], `Tanda_Terima_${nasabah.nama_nasabah || 'Nasabah'}.pdf`, { type: "application/pdf" });

        // Cek dukungan Web Share API untuk sharing file
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `Tanda Terima - ${nasabah.nama_nasabah || 'Nasabah'}`,
                text: `Berikut file PDF tanda terima polis asuransi Anda.`
            });
        } else {
            // Fallback: Unduh otomatis di desktop
            html2pdf().from(printArea).set(opt).save();
            alert("Browser tidak mendukung share langsung. File PDF tanda terima telah diunduh otomatis. Silakan kirim file tersebut manual ke WhatsApp.");
        }
    } catch (err) {
        console.error("Gagal ekspor PDF:", err);
        // Hapus elemen jika terjadi error
        if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
        if (document.body.contains(loadingOverlay)) document.body.removeChild(loadingOverlay);
        if (document.head.contains(style)) document.head.removeChild(style);
        alert("Terjadi kesalahan saat menyiapkan PDF.");
    } finally {
        btnShare.disabled = false;
        btnShare.innerHTML = originalText;
    }
}

// ==========================================
// FUNGSI KIRIM WHATSAPP CLICK-TO-CHAT
// ==========================================
async function kirimWhatsApp(item) {
    const nasabah = item.nasabah || {};
    const nomorWa = prompt("Masukkan nomor WhatsApp Nasabah (tanpa tanda + atau 0, awali dengan 62):\nContoh: 628123456789", "62");
    if (!nomorWa || nomorWa.trim().length < 10) return;

    // Ambil semua jaminan nasabah
    let allJaminan = [];
    try {
        const { data } = await supabaseClient
            .from("jaminan_polis")
            .select("*")
            .eq("nasabah_id", item.nasabah_id);
        if (data) allJaminan = data;
    } catch (err) { /* skip */ }

    const tanggal = new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
    let daftarJaminan = allJaminan.map((j, idx) =>
        `${idx + 1}. ${j.merk_kendaraan} ${j.tipe_kendaraan} (${j.tahun_kendaraan})\n   No. Polis: ${j.no_polis || 'Belum ada'}`
    ).join('\n');

    // URL halaman publik di GitHub Pages
    const publicReceiptUrl = `https://programdeviwimala.github.io/polisasuransi/tanda_terima.html?id=${item.id}`;

    const pesan =
`*TANDA TERIMA POLIS ASURANSI*
━━━━━━━━━━━━━━━━━━━━━━━━
Yth. Bpk/Ibu *${nasabah.nama_nasabah || '-'}*
No PK: *${nasabah.no_pk || '-'}*

*Jaminan Kendaraan:*
${daftarJaminan}

Tanggal Serah Terima: *${tanggal}*
Diserahkan oleh: *${currentUser ? currentUser.username : 'Admin'}*
━━━━━━━━━━━━━━━━━━━━━━━━
*Link Tanda Terima Resmi Anda:*
${publicReceiptUrl}

_BPR Cahaya Fajar Jatiwangi_`;

    const url = `https://wa.me/${nomorWa.trim()}?text=${encodeURIComponent(pesan)}`;
    window.open(url, '_blank');
}

// ==========================================
// FITUR HAPUS DATA NASABAH (1 PK = semua jaminannya ikut terhapus)
// ==========================================

// Ekstrak angka dari No PK (angka setelah slash kedua)
function extractPkNumber(noPk) {
    if (!noPk) return 0;
    const parts = noPk.split('/');
    const lastPart = parts[parts.length - 1];
    return parseInt(lastPart.replace(/[^0-9]/g, ''), 10) || 0;
}

// Toggle pilihan nasabah untuk hapus massal
window.toggleNasabahSelect = function(event, nasabahId) {
    event.stopPropagation();
    if (!nasabahId || nasabahId === 'null' || nasabahId === 'undefined') return;
    const idx = selectedNasabahIds.indexOf(nasabahId);
    if (idx === -1) {
        selectedNasabahIds.push(nasabahId);
    } else {
        selectedNasabahIds.splice(idx, 1);
    }
    updateDeleteToolbar();
};

function updateDeleteToolbar() {
    const toolbar = document.getElementById('delete-toolbar');
    const countBadge = document.getElementById('delete-count-badge');
    if (!toolbar) return;
    if (selectedNasabahIds.length > 0) {
        toolbar.style.display = 'flex';
        countBadge.innerText = `${selectedNasabahIds.length} Nasabah Dipilih`;
    } else {
        toolbar.style.display = 'none';
    }
}

// Hapus 1 nasabah beserta jaminannya
window.konfirmasiHapusNasabah = function(event, nasabahId, namaNasabah, noPk) {
    event.stopPropagation();
    if (!nasabahId || nasabahId === 'null') return;
    if (!confirm(`🗑️ Hapus Nasabah?\n\nNama: ${namaNasabah}\nNo PK: ${noPk}\n\nSemua jaminan polis terkait No PK ini akan ikut TERHAPUS PERMANEN.\n\nLanjutkan?`)) return;
    hapusNasabahById(nasabahId, namaNasabah);
};

async function hapusNasabahById(nasabahId, namaNasabah) {
    try {
        // 1. Hapus semua jaminan polis milik nasabah ini
        const { error: errJaminan } = await supabaseClient
            .from('jaminan_polis')
            .delete()
            .eq('nasabah_id', nasabahId);
        if (errJaminan) throw errJaminan;

        // 2. Hapus nasabah itu sendiri
        const { error: errNasabah } = await supabaseClient
            .from('nasabah')
            .delete()
            .eq('id', nasabahId);
        if (errNasabah) throw errNasabah;

        alert(`✅ Nasabah "${namaNasabah}" dan seluruh jaminannya berhasil dihapus.`);
        fetchDataAdmin();
    } catch (err) {
        alert('Gagal menghapus data: ' + err.message);
    }
}

// Hapus massal semua nasabah yang dipilih
async function hapusMassalNasabah() {
    if (selectedNasabahIds.length === 0) return;
    const jumlah = selectedNasabahIds.length;
    if (!confirm(`🗑️ Hapus ${jumlah} Nasabah Sekaligus?\n\nSemua jaminan polis dari ${jumlah} nasabah ini akan ikut TERHAPUS PERMANEN.\n\nTindakan ini tidak dapat dibatalkan. Lanjutkan?`)) return;

    const toolbar = document.getElementById('delete-toolbar');
    const btnHapusMassal = document.getElementById('btn-hapus-massal');
    btnHapusMassal.disabled = true;
    btnHapusMassal.innerText = '⏳ Menghapus...';

    let berhasil = 0;
    for (const id of selectedNasabahIds) {
        try {
            await supabaseClient.from('jaminan_polis').delete().eq('nasabah_id', id);
            await supabaseClient.from('nasabah').delete().eq('id', id);
            berhasil++;
        } catch (err) {
            console.error('Gagal hapus nasabah id:', id, err);
        }
    }

    alert(`✅ ${berhasil} dari ${jumlah} nasabah berhasil dihapus.`);
    selectedNasabahIds = [];
    fetchDataAdmin();
}

window.hapusMassalNasabah = hapusMassalNasabah;

// ==========================================
// FITUR KELOLA PENGGUNA (USER MANAGEMENT)
// ==========================================
function setupUserManagement() {
    const userForm = document.getElementById("user-form");
    if (userForm) {
        userForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("user-username").value.trim().toLowerCase();
            const password = document.getElementById("user-password").value.trim();
            const role = document.getElementById("user-role").value;

            if (!username || !password) {
                alert("Username dan Password tidak boleh kosong!");
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from("pengguna")
                    .insert([{ username, password, role }]);

                if (error) {
                    if (error.code === "23505") { // Unique violation
                        alert("Username sudah terdaftar! Gunakan username lain.");
                    } else {
                        throw error;
                    }
                    return;
                }

                alert("Pengguna baru berhasil ditambahkan!");
                userForm.reset();
                fetchUsersList();
            } catch (err) {
                alert("Gagal menambahkan pengguna: " + err.message);
            }
        });
    }
}

async function fetchUsersList() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from("pengguna")
            .select("*")
            .order("id", { ascending: true });

        if (error) throw error;

        const tbody = document.getElementById("user-list-tbody");
        tbody.innerHTML = "";

        if (data) {
            data.forEach(user => {
                const tr = document.createElement("tr");
                
                // Jangan hapus admin default
                const canDelete = user.username !== 'admin';
                const deleteBtnHtml = canDelete 
                    ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id}, '${user.username}')" style="padding: 4px 8px; font-size:11px;">Hapus</button>` 
                    : `<span style="color:var(--text-muted); font-size:11px;">Default</span>`;

                tr.innerHTML = `
                    <td style="padding: 12px; border-bottom: 1px solid var(--border-color); font-weight:600;">${user.username}</td>
                    <td style="padding: 12px; border-bottom: 1px solid var(--border-color);"><span class="card-tag ${user.role === 'admin' ? 'tag-arrived' : 'tag-delivery'}" style="margin:0;">${user.role}</span></td>
                    <td style="padding: 12px; border-bottom: 1px solid var(--border-color); font-family: monospace;">${user.password}</td>
                    <td style="padding: 12px; border-bottom: 1px solid var(--border-color); text-align: center;">${deleteBtnHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Gagal mengambil data pengguna:", err);
    }
}

async function deleteUser(id, username) {
    if (confirm(`Apakah Anda yakin ingin menghapus pengguna '${username}'?`)) {
        try {
            const { error } = await supabaseClient
                .from("pengguna")
                .delete()
                .eq("id", id);

            if (error) throw error;
            alert(`Pengguna '${username}' berhasil dihapus!`);
            fetchUsersList();
        } catch (err) {
            alert("Gagal menghapus pengguna: " + err.message);
        }
    }
}

// Ekspos ke global scope agar onclick HTML bisa manggil
window.deleteUser = deleteUser;
window.fetchUsersList = fetchUsersList;

// ==========================================
// FITUR IMPORT DATA NASABAH DARI EXCEL
// ==========================================
let parsedExcelData = [];

function setupExcelImport() {
    const btnManual = document.getElementById("btn-input-manual");
    const btnExcel = document.getElementById("btn-input-excel");
    const containerManual = document.getElementById("container-input-manual");
    const containerExcel = document.getElementById("container-input-excel");
    
    if (btnManual && btnExcel) {
        btnManual.addEventListener("click", () => {
            btnManual.classList.add("active");
            btnExcel.classList.remove("active");
            containerManual.style.display = "block";
            containerExcel.style.display = "none";
        });

        btnExcel.addEventListener("click", () => {
            btnExcel.classList.add("active");
            btnManual.classList.remove("active");
            containerExcel.style.display = "block";
            containerManual.style.display = "none";
        });
    }

    const fileInput = document.getElementById("excel-file-input");
    const fileInfo = document.getElementById("excel-file-info");
    const previewSection = document.getElementById("excel-preview-section");
    const previewTbody = document.getElementById("excel-preview-tbody");
    const rowCountBadge = document.getElementById("excel-row-count");

    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileInfo.style.display = "block";
            fileInfo.innerText = `📄 Membaca: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    
                    parsedExcelData = parseExcelSheet(workbook);
                    if (!parsedExcelData || parsedExcelData.length === 0) {
                        previewSection.style.display = "none";
                        return;
                    }

                    // Tampilkan preview
                    previewTbody.innerHTML = "";
                    parsedExcelData.forEach((row) => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); font-weight: ${row.is_new_nasabah ? '600' : 'normal'}; color: ${row.is_new_nasabah ? 'var(--secondary)' : 'var(--text-muted)'};">
                                ${row.no_pk || '<em>(Sama seperti atas)</em>'}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); font-weight: ${row.is_new_nasabah ? '600' : 'normal'};">
                                ${row.nama_nasabah}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-muted);">
                                ${row.nama_marketing}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: right; color: ${row.is_new_nasabah ? 'var(--text-main)' : 'var(--text-muted)'};">
                                ${row.is_new_nasabah ? formatRupiah(row.plafond) : '-'}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: center; color: ${row.is_new_nasabah ? 'var(--text-main)' : 'var(--text-muted)'};">
                                ${row.is_new_nasabah ? `${row.jangka_waktu} Bln` : '-'}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: center; color: ${row.is_new_nasabah ? 'var(--text-main)' : 'var(--text-muted)'};">
                                ${row.is_new_nasabah ? formatTanggalPreview(row.periode_awal) : '-'}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: center; color: ${row.is_new_nasabah ? 'var(--text-main)' : 'var(--text-muted)'};">
                                ${row.is_new_nasabah ? formatTanggalPreview(row.periode_akhir) : '-'}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: center; color: ${row.is_new_nasabah ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight: 600;">
                                ${row.is_new_nasabah ? `${row.bunga.toFixed(2)}%` : '-'}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); font-weight: 600;">
                                ${row.merk_kendaraan}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
                                ${row.tipe_kendaraan}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: center;">
                                ${row.tahun_kendaraan}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: right; font-weight: 600;">
                                ${formatRupiah(row.harga_taksasi)}
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: center;">
                                <span class="card-tag ${row.keterangan === 'Baru' ? 'tag-waiting' : 'tag-done'}" style="margin: 0;">${row.keterangan}</span>
                            </td>
                        `;
                        previewTbody.appendChild(tr);
                    });

                    rowCountBadge.innerText = `${parsedExcelData.length} Jaminan`;
                    previewSection.style.display = "block";
                } catch (err) {
                    alert("Gagal membaca file Excel: " + err.message);
                    previewSection.style.display = "none";
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    const btnUpload = document.getElementById("btn-upload-excel");
    if (btnUpload) {
        btnUpload.addEventListener("click", async () => {
            if (parsedExcelData.length === 0) {
                alert("Tidak ada data untuk diunggah!");
                return;
            }

            btnUpload.disabled = true;
            btnUpload.innerText = "⏳ Menyimpan ke database... Silakan tunggu";

            let successCount = 0;
            let lastNasabahId = null;

            try {
                for (let i = 0; i < parsedExcelData.length; i++) {
                    const row = parsedExcelData[i];
                    let nasabahId = null;

                    btnUpload.innerText = `⏳ Menyimpan data ${i + 1} dari ${parsedExcelData.length}...`;

                    if (row.is_new_nasabah) {
                        // Cek apakah No PK sudah ada di DB
                        let { data: existing } = await supabaseClient
                            .from("nasabah")
                            .select("id")
                            .eq("no_pk", row.no_pk)
                            .maybeSingle();

                        if (existing) {
                            nasabahId = existing.id;
                        } else {
                            const { data: inserted, error: insErr } = await supabaseClient
                                .from("nasabah")
                                .insert([{
                                    nama_nasabah: row.nama_nasabah,
                                    nama_marketing: row.nama_marketing,
                                    no_pk: row.no_pk,
                                    plafond: row.plafond,
                                    jangka_waktu: row.jangka_waktu,
                                    periode_awal: row.periode_awal,
                                    periode_akhir: row.periode_akhir,
                                    bunga: row.bunga,
                                    keterangan: row.keterangan
                                }])
                                .select("id")
                                .single();

                            if (insErr) {
                                if (insErr.message.includes("check constraint")) {
                                    throw new Error(`Gagal menyimpan nasabah '${row.nama_nasabah}' karena keterangan '${row.keterangan}' melanggar aturan database. Silakan jalankan perintah SQL ALTER TABLE di Supabase SQL Editor Anda untuk membuang batasan tersebut.`);
                                }
                                throw insErr;
                            }
                            nasabahId = inserted.id;
                        }

                        lastNasabahId = nasabahId;
                    } else {
                        // Jaminan tambahan untuk nasabah sebelumnya
                        nasabahId = lastNasabahId;
                    }

                    if (!nasabahId) {
                        throw new Error(`Jaminan baris ke-${i + 1} tidak memiliki Nomor PK nasabah induk.`);
                    }

                    // Simpan data jaminan kendaraan
                    const { error: jamErr } = await supabaseClient
                        .from("jaminan_polis")
                        .insert([{
                            nasabah_id: nasabahId,
                            merk_kendaraan: row.merk_kendaraan,
                            tipe_kendaraan: row.tipe_kendaraan,
                            tahun_kendaraan: row.tahun_kendaraan,
                            harga_taksasi: row.harga_taksasi,
                            asuransi_pilihan: 'Belum Ditentukan',
                            status: 'Menunggu Polis'
                        }]);

                    if (jamErr) throw jamErr;
                    successCount++;
                }

                alert(`🎉 Berhasil menyimpan ${successCount} data jaminan nasabah ke database Supabase!`);
                
                // Reset form
                fileInput.value = "";
                fileInfo.style.display = "none";
                previewSection.style.display = "none";
                parsedExcelData = [];

                // Pindah ke dashboard admin
                location.reload(); // Refresh untuk melihat data terbaru di dashboard

            } catch (err) {
                alert("Proses terhenti karena error: " + err.message);
            } finally {
                btnUpload.disabled = false;
                btnUpload.innerText = "💾 Simpan Semua ke Database";
            }
        });
    }
}

function formatTanggalPreview(dateStr) {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function parseExcelDate(val) {
    if (!val && val !== 0) return null;
    
    // 1. Jika angka (Excel serial date number)
    if (typeof val === 'number' && val > 0) {
        return excelSerialToDate(val);
    }
    
    // 2. Jika string
    const str = String(val).trim();
    if (!str) return null;
    
    // Cocokkan format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    
    // Cocokkan format D/M/YYYY atau DD/MM/YYYY (Indonesian: day/month/year)
    const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = str.match(dmyRegex);
    if (match) {
        let day = match[1];
        let month = match[2];
        let year = match[3];
        if (year.length === 2) {
            year = "20" + year;
        }
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    return null;
}

function excelSerialToDate(serial) {
    // Excel date serial ke tanggal YYYY-MM-DD tanpa pengaruh timezone
    // Serial 1 = 1 Januari 1900 (Excel menghitung leap year 1900 secara salah, jadi serial 60 = bug, 61 = 1 Maret 1900)
    if (serial < 1) return null;
    
    // Koreksi untuk bug leap year 1900 Excel
    let adjustedSerial = serial;
    if (serial >= 60) {
        adjustedSerial = serial - 1; // Skip serial 60 (29 Feb 1900 yang tidak nyata)
    }
    
    // Basis: 1 Januari 1900 = serial 1
    // Konversi ke hari sejak 31 Desember 1899 (Unix epoch dari Excel)
    const msPerDay = 86400000;
    const excelEpoch = new Date(Date.UTC(1899, 11, 31)); // 31 Des 1899 UTC
    const dateMs = excelEpoch.getTime() + adjustedSerial * msPerDay;
    const d = new Date(dateMs);
    
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseExcelSheet(workbook) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerRowIndex = -1;
    let colIndices = {
        marketing: -1,
        nama_nasabah: -1,
        no_pk: -1,
        plafond: -1,
        jangka_waktu: -1,
        periode_awal: -1,
        periode_akhir: -1,
        merk: -1,
        type: -1,
        thn: -1,
        taksasi: -1,
        bunga: -1,
        keterangan: -1
    };

    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;
        
        const hasPk = row.some(cell => String(cell).toUpperCase().includes("NOMOR PK") || String(cell).toUpperCase().includes("NO. PK") || String(cell).toUpperCase() === "NO PK");
        const hasNasabah = row.some(cell => String(cell).toUpperCase().includes("NAMA NASABAH") || String(cell).toUpperCase() === "NASABAH");
        
        if (hasPk && hasNasabah) {
            headerRowIndex = i;
            const nextRow = rawData[i + 1] || [];
            row.forEach((cell, cellIdx) => {
                const cellStr = String(cell).toUpperCase().trim();
                const nextCellStr = nextRow[cellIdx] ? String(nextRow[cellIdx]).toUpperCase().trim() : "";
                const combinedStr = `${cellStr} ${nextCellStr}`.trim();
                
                if (combinedStr.includes("MARKETING")) colIndices.marketing = cellIdx;
                else if (combinedStr.includes("NAMA NASABAH") || combinedStr === "NASABAH") colIndices.nama_nasabah = cellIdx;
                else if (combinedStr.includes("NOMOR PK") || combinedStr.includes("NO. PK") || combinedStr === "NO PK") colIndices.no_pk = cellIdx;
                else if (combinedStr.includes("PLAFOND") || combinedStr.includes("PLAFON") || combinedStr.includes("JUMLAH")) colIndices.plafond = cellIdx;
                else if (combinedStr.includes("JW") || combinedStr.includes("JANGKA WAKTU") || combinedStr.includes("BULAN")) colIndices.jangka_waktu = cellIdx;
                else if (combinedStr.includes("PERIODE AWAL") || combinedStr.includes("AWAL") || combinedStr.includes("MULAI") || combinedStr.includes("TGL PENCAIRAN")) colIndices.periode_awal = cellIdx;
                else if (combinedStr.includes("PERIODE AKHIR") || combinedStr.includes("AKHIR") || combinedStr.includes("SELESAI")) colIndices.periode_akhir = cellIdx;
                else if (combinedStr.includes("MERK")) colIndices.merk = cellIdx;
                else if (combinedStr.includes("TYPE") || combinedStr.includes("TIPE")) colIndices.type = cellIdx;
                else if (combinedStr.includes("THN") || combinedStr.includes("TAHUN")) colIndices.thn = cellIdx;
                else if (combinedStr.includes("TAKSASI") || combinedStr.includes("HARGA TAKSASI") || combinedStr.includes("HARGA") || combinedStr.includes("TAKSIRAN")) colIndices.taksasi = cellIdx;
                else if (combinedStr.includes("SPREAD RATE") || combinedStr.includes("BUNGA") || combinedStr.includes("RATE") || combinedStr.includes("PERSEN") || combinedStr.includes("INTEREST")) colIndices.bunga = cellIdx;
                else if (combinedStr.includes("KETERANGAN") || combinedStr.includes("KET")) colIndices.keterangan = cellIdx;
            });
            break;
        }
    }

    if (headerRowIndex === -1) {
        alert("Format Excel tidak dikenali! Pastikan terdapat baris header dengan nama kolom 'NOMOR PK' dan 'NAMA NASABAH'.");
        return null;
    }

    // Tampilkan info deteksi kolom di UI
    const debugInfo = document.getElementById("excel-debug-info");
    if (debugInfo) {
        debugInfo.style.display = "block";
        debugInfo.innerHTML = "<strong>Status Deteksi Kolom Excel:</strong><br>" + 
            Object.keys(colIndices).map(k => {
                const status = colIndices[k] !== -1 ? `<span style="color:#15803d">Kolom ke-${colIndices[k] + 1} (OK)</span>` : `<span style="color:var(--danger)">Tidak Ditemukan</span>`;
                return `• ${k.replace("_", " ").toUpperCase()}: ${status}`;
            }).join("<br>");
    }

    const items = [];
    let lastParsedNasabah = null;

    let dataStartRowIndex = headerRowIndex + 1;
    const nextRow = rawData[headerRowIndex + 1] || [];
    const isSubHeader = nextRow.some(cell => {
        const str = String(cell).toUpperCase().trim();
        return str === "AWAL" || str === "AKHIR" || str === "BLN" || str === "TAHUN" || str === "BULAN";
    });
    if (isSubHeader) {
        dataStartRowIndex = headerRowIndex + 2;
    }

    for (let i = dataStartRowIndex; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const merk = colIndices.merk !== -1 ? String(row[colIndices.merk] || "").trim() : "";
        const tipe = colIndices.type !== -1 ? String(row[colIndices.type] || "").trim() : "";
        
        if (!merk && !tipe) continue;

        const rawNoPk = colIndices.no_pk !== -1 ? String(row[colIndices.no_pk] || "").trim() : "";
        const rawNama = colIndices.nama_nasabah !== -1 ? String(row[colIndices.nama_nasabah] || "").trim() : "";

        let nasabahData = null;

        if (rawNoPk || rawNama) {
            const plafondRaw = colIndices.plafond !== -1 ? row[colIndices.plafond] : 0;
            const jwRaw = colIndices.jangka_waktu !== -1 ? row[colIndices.jangka_waktu] : 0;
            const tglAwalRaw = colIndices.periode_awal !== -1 ? row[colIndices.periode_awal] : null;
            const tglAkhirRaw = colIndices.periode_akhir !== -1 ? row[colIndices.periode_akhir] : null;
            const bungaRaw = colIndices.bunga !== -1 ? row[colIndices.bunga] : 0;
            const ketRaw = colIndices.keterangan !== -1 ? String(row[colIndices.keterangan] || "").trim() : "Baru";

            const plafond = parseFloat(String(plafondRaw).replace(/[^0-9\.]/g, "")) || 0;
            const jangka_waktu = parseInt(String(jwRaw).replace(/[^0-9]/g, "")) || 0;
            const periode_awal = parseExcelDate(tglAwalRaw);
            const periode_akhir = parseExcelDate(tglAkhirRaw);
            
            // Debug: tampilkan nilai raw tanggal untuk baris pertama data
            if (i === dataStartRowIndex) {
                const debugInfo = document.getElementById("excel-debug-info");
                if (debugInfo) {
                    const existingContent = debugInfo.innerHTML;
                    debugInfo.innerHTML = existingContent + 
                        `<br><strong>Debug Tanggal (Baris Pertama Data):</strong><br>` +
                        `• Raw Awal: <em>${JSON.stringify(tglAwalRaw)}</em> (type: ${typeof tglAwalRaw}) → Hasil: <strong>${periode_awal}</strong><br>` +
                        `• Raw Akhir: <em>${JSON.stringify(tglAkhirRaw)}</em> (type: ${typeof tglAkhirRaw}) → Hasil: <strong>${periode_akhir}</strong>`;
                }
            }
            
            let bunga = parseFloat(String(bungaRaw).replace(/[^0-9\.\,]/g, "").replace(",", ".")) || 0;
            if (bunga > 0 && bunga < 1) {
                bunga = bunga * 100;
            }

            let keterangan = ketRaw;
            if (ketRaw.toUpperCase().includes("LUNAS")) keterangan = "RO LUNAS";
            else if (ketRaw.toUpperCase().includes("KM")) keterangan = "RO KM";
            else if (ketRaw.toUpperCase().includes("BARU")) keterangan = "Baru";

            nasabahData = {
                nama_nasabah: rawNama,
                nama_marketing: colIndices.marketing !== -1 ? String(row[colIndices.marketing] || "").trim() : "Admin",
                no_pk: rawNoPk,
                plafond: plafond,
                jangka_waktu: jangka_waktu,
                periode_awal: periode_awal,
                periode_akhir: periode_akhir,
                bunga: bunga,
                keterangan: keterangan
            };

            lastParsedNasabah = nasabahData;
        } else {
            nasabahData = lastParsedNasabah;
        }

        if (!nasabahData) continue;

        const thnRaw = colIndices.thn !== -1 ? row[colIndices.thn] : 0;
        const taksasiRaw = colIndices.taksasi !== -1 ? row[colIndices.taksasi] : 0;

        const tahun_kendaraan = parseInt(String(thnRaw).replace(/[^0-9]/g, "")) || 2020;
        const harga_taksasi = parseFloat(String(taksasiRaw).replace(/[^0-9\.]/g, "")) || 0;

        items.push({
            nama_nasabah: nasabahData.nama_nasabah,
            nama_marketing: nasabahData.nama_marketing,
            no_pk: nasabahData.no_pk,
            plafond: nasabahData.plafond,
            jangka_waktu: nasabahData.jangka_waktu,
            periode_awal: nasabahData.periode_awal,
            periode_akhir: nasabahData.periode_akhir,
            bunga: nasabahData.bunga,
            keterangan: nasabahData.keterangan,
            is_new_nasabah: !!(rawNoPk || rawNama),
            merk_kendaraan: merk,
            tipe_kendaraan: tipe,
            tahun_kendaraan: tahun_kendaraan,
            harga_taksasi: harga_taksasi,
            asuransi_pilihan: 'Belum Ditentukan'
        });
    }

    return items;
}


