// DATABASE AKUN (Simulasi)
const ACCOUNTS = {
    "admin1": { pass: "123", name: "Zaky Laundry Makassar", id: "ST_001" },
    "admin2": { pass: "456", name: "Laundry Berkah Jaya", id: "ST_002" }
};

let currentUser = null;
let orders = [];
let nextId = 1;
let myChart = null;
let currentTab = 'active';

const STATUS_FLOW = ["Menunggu", "Dicuci", "Dikeringkan", "Disetrika", "Selesai"];

// --- AUTH GUARD ---
window.onload = () => {
    const savedUser = localStorage.getItem('loggedUser');
    const isDashboard = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/');

    if (isDashboard) {
        if (!savedUser) return window.location.href = 'login.html';
        currentUser = JSON.parse(savedUser);
        initDashboard();
    } else if (savedUser && window.location.pathname.includes('login.html')) {
        window.location.href = 'index.html';
    }
};

async function handleLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');
    const btnId = 'btnLogin'; // ID tombol di login.html
    const originalText = 'Masuk ke Sistem <i class="fas fa-sign-in-alt"></i>';

    // Validasi sederhana sebelum kirim ke server
    if (!u || !p) {
        showToast("Username dan Password wajib diisi!", "error");
        return;
    }

    // 1. Mulai Loading
    toggleLoading(btnId, true, originalText);

    try {
        const response = await fetch('http://192.168.1.3:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });

        const result = await response.json();

        if (response.ok) {
            // Simpan data admin ke localStorage
            localStorage.setItem('loggedUser', JSON.stringify(result.user));
            showToast("Login Berhasil!", "success");
            
            // Beri jeda sedikit agar animasi loading terlihat sebelum pindah halaman
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 800);
        } else {
            if (errorEl) errorEl.style.display = 'block';
            showToast(result.message || "Login Gagal", "error");
        }
    } catch (err) {
        showToast("Server Offline!.", "error");
    } finally {
        // 2. Matikan Loading jika gagal
        // Jika sukses, kita tidak perlu mematikan loading karena halaman akan pindah
        if (window.location.pathname.includes('login.html')) {
            toggleLoading(btnId, false, originalText);
        }
    }
}

function handleLogout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'login.html';
}

function initDashboard() {
    // Tampilkan container dashboard
    const dashboard = document.getElementById('mainDashboard');
    if (dashboard) dashboard.style.display = 'block';

    // Ganti nama toko sesuai admin yang login
    const nameDisplay = document.getElementById('shopNameDisplay');
    if (nameDisplay) nameDisplay.innerText = `🧺 ${currentUser.name}`;

    // Ambil data dari Node.js (Penting agar tabel terisi)
    setupDeleteEventListener();
    loadOrdersFromServer();
}

// function initDashboard() {
//     document.getElementById('loginScreen').style.display = 'none';
//     document.getElementById('mainDashboard').style.display = 'block';
//     document.getElementById('shopNameDisplay').innerText = `🧺 ${currentUser.name}`;

//     const storageKey = `orders_${currentUser.id}`;
//     orders = JSON.parse(localStorage.getItem(storageKey)) || [];
//     nextId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;

//     sortData();
//     refreshUI();
// }

// --- LOGIKA BISNIS ---
function hitungHarga(berat, jenis, layanan) {
    const dasar = 5000;
    const mJenis = { "Baju": 1, "Celana": 1.2, "Jaket": 1.5, "Selimut": 2 }[jenis];
    const mLayan = { "Normal": 1, "Fast": 1.5, "Express": 2 }[layanan];
    let total = (berat * dasar) * mJenis * mLayan;
    return berat > 10 ? total * 0.9 : total;
}

async function tambahOrder() {
    const btnId = 'btnSimpanOrder';
    const originalText = `Simpan Order Baru <i class="fas fa-save"></i>`;

    const nama = document.getElementById('nama').value;
    const telp = document.getElementById('telp').value;
    const berat = parseFloat(document.getElementById('berat').value);
    const jenis = document.getElementById('jenis').value;
    const layanan = document.getElementById('layanan').value;
    const bayar = document.getElementById('pembayaran').value;

    // PINDAHKAN VALIDASI KE ATAS sebelum loading dimulai
    if (!nama || !telp || isNaN(berat)) {
        return alert("Data tidak lengkap!");
    }

    // 1. Mulai Loading (Hanya jika data valid)
    toggleLoading(btnId, true);

    const orderBaru = {
        nama, telp, berat, jenis, layanan, bayar,
        status: "Menunggu",
        total: hitungHarga(berat, jenis, layanan),
        shopId: currentUser.id
    };

    try {
        const response = await fetch('http://192.168.1.3:5000/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderBaru)
        });

        if (response.ok) {
            showToast("Order berhasil disimpan!", "success");
            // Reset Form (Cukup sekali saja)
            document.getElementById('nama').value = "";
            document.getElementById('telp').value = "";
            document.getElementById('berat').value = "";

            await loadOrdersFromServer(); // Tunggu data terupdate
        } else {
            throw new Error("Respon server tidak oke");
        }
    } catch (err) {
        showToast("Gagal terhubung ke server", "error");
    } finally {
        // 2. Matikan Loading selalu di akhir proses asinkron
        toggleLoading(btnId, false, originalText);
    }
}

function toggleLoading(buttonId, isLoading, originalText) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (isLoading) {
        btn.classList.add('btn-loading');
        btn.innerHTML = `<span class="spinner"></span> Memproses...`;
    } else {
        btn.classList.remove('btn-loading');
        btn.innerHTML = originalText;
    }
}

async function loadOrdersFromServer() {
    const list = document.getElementById('orderList');

    try {
        const response = await fetch('http://192.168.1.3:5000/api/orders');

        // Jika server merespon tapi ada masalah (misal: 404 atau 500)
        if (!response.ok) throw new Error("Gagal mengambil data dari server");

        const data = await response.json();
        orders = data.filter(item => item.shopId === currentUser.id);
        refreshUI();

    } catch (error) {
        console.error("Negative Case Terdeteksi:", error);

        // Tampilkan pesan gagal di dalam tabel agar user tahu
        if (list) {
            list.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 50px; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 15px;"></i><br>
                        <strong>Gagal terhubung ke server!</strong><br>
                        Pastikan server Node.js sudah dijalankan.
                    </td>
                </tr>`;
        }
    }
}

// function updateStatus(id) {
//     const i = orders.findIndex(o => o.id === id);
//     let currentIdx = STATUS_FLOW.indexOf(orders[i].status);
//     if (currentIdx < STATUS_FLOW.length - 1) {
//         orders[i].status = STATUS_FLOW[currentIdx + 1];
//         saveData();
//     }
// }

async function updateStatus(id) {
    try {
        const response = await fetch(`http://192.168.1.3:5000/api/orders/update/${id}`);
        if (response.ok) {
            loadOrdersFromServer(); // Refresh tampilan
        }
    } catch (err) {
        console.error("Gagal update status:", err);
    }
}

// Fitur Baru: Toggle Status Pembayaran
async function toggleBayar(id) {
    try {
        const response = await fetch(`http://192.168.1.3:5000/api/orders/pay/${id}`);
        
        if (response.ok) {
            showToast("Status pembayaran diperbarui!", "success");
            // Ambil data terbaru dari server agar UI sinkron
            await loadOrdersFromServer(); 
        } else {
            throw new Error();
        }
    } catch (err) {
        showToast("Gagal memperbarui pembayaran", "error");
        console.error("Error toggle bayar:", err);
    }
}

function saveData() {
    localStorage.setItem(`orders_${currentUser.id}`, JSON.stringify(orders));
    refreshUI();
}

function refreshUI() {
    renderStats();
    renderChart();
    renderTable();
    renderRekap();
}

function renderStats() {
    const total = orders.reduce((s, o) => s + o.total, 0);
    const aktif = orders.filter(o => o.status !== "Selesai").length;
    document.getElementById('totalPendapatan').innerText = `Rp ${Math.round(total).toLocaleString()}`;
    document.getElementById('orderAktif').innerText = aktif;
}

function renderChart() {
    const data = { "Express": 0, "Fast": 0, "Normal": 0 };
    orders.forEach(o => data[o.layanan]++);

    const ctx = document.getElementById('laundryChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
        }
    });
}

function renderTable() {
    const list = document.getElementById('orderList');
    list.innerHTML = "";

    const filtered = orders.filter(o =>
        currentTab === 'active' ? o.status !== 'Selesai' : o.status === 'Selesai'
    );

    filtered.forEach(o => {
        const isSelesai = o.status === "Selesai";
        const isLunas = o.bayar === "Lunas";
        list.innerHTML += `
            <tr class="${isSelesai ? 'selesai' : ''}">
                <td>${o.id}</td>
                <td>${o.nama}<br><small>${o.telp}</small></td>
                <td>${o.berat}kg</td>
                <td><strong>${isSelesai ? '✅ SELESAI' : o.status}</strong></td>
                <td>Rp ${Math.round(o.total).toLocaleString()}</td>
                <td>
                    <button class="badge-pay ${isLunas ? 'pay-lunas' : 'pay-belum'}" onclick="toggleBayar(${o.id})">
                        ${o.bayar}
                    </button>
                </td>
                <td>
                    <button class="btn-next" onclick="updateStatus(${o.id})" ${isSelesai ? 'disabled' : ''}><i class="fas fa-arrow-right"></i></button>
                    <button class="btn-wa" onclick="kirimWA(${o.id})"><i class="fab fa-whatsapp"></i></button>
                    <button class="btn-print" onclick="cetakStruk(${o.id})"><i class="fas fa-print"></i></button>
                    <button class="btn-delete" onclick="hapusOrder(${o.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
}


let orderIdToDelete = null; // Variabel temporary

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    orderIdToDelete = null;
}

// --- MODAL KONFIRMASI HAPUS ---
function setupDeleteEventListener() {
    const btnConfirm = document.getElementById('btnConfirmDelete');
    if (!btnConfirm) return;

    btnConfirm.onclick = async function() {
        if (!orderIdToDelete) return;

        toggleLoading('btnConfirmDelete', true, 'Ya, Hapus');

        try {
            const response = await fetch(`http://192.168.1.3:5000/api/orders/${orderIdToDelete}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast("Order berhasil dihapus!", "success");
                await loadOrdersFromServer();
            } else {
                throw new Error();
            }
        } catch (err) {
            showToast("Gagal menghapus data", "error");
        } finally {
            toggleLoading('btnConfirmDelete', false, 'Ya, Hapus');
            closeDeleteModal();
        }
    };
}

// Fungsi yang dipanggil saat tombol trash di tabel diklik
function hapusOrder(id) {
    orderIdToDelete = id;
    document.getElementById('deleteModal').style.display = 'flex';
}

// Pasang event listener buat tombol "Ya, Hapus" di dalam modal
document.getElementById('btnConfirmDelete').onclick = async function () {
    if (!orderIdToDelete) return;

    const btn = document.getElementById('btnConfirmDelete');
    toggleLoading('btnConfirmDelete', true, 'Ya, Hapus');

    try {
        const response = await fetch(`http://192.168.1.3:5000/api/orders/${orderIdToDelete}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast("Order berhasil dihapus!", "success");
            loadOrdersFromServer();
        } else {
            throw new Error();
        }
    } catch (err) {
        showToast("Gagal menghapus data", "error");
    } finally {
        toggleLoading('btnConfirmDelete', false, 'Ya, Hapus');
        closeDeleteModal();
    }
};


function cariPelanggan() {
    const f = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('#orderList tr').forEach(r => {
        r.style.display = r.cells[1].innerText.toLowerCase().includes(f) ? "" : "none";
    });
}

function sortData() {
    const sortBy = document.getElementById('sortOrder').value;

    orders.sort((a, b) => {
        if (sortBy === 'newest') {
            return b.id - a.id; // ID lebih besar berarti lebih baru
        } else if (sortBy === 'oldest') {
            return a.id - b.id;
        } else if (sortBy === 'highest') {
            return b.total - a.total;
        } else if (sortBy === 'lowest') {
            return a.total - b.total;
        }
    });

    renderTable(); // Tampilkan ulang data yang sudah di-sort
}

function renderRekap() {
    // Menghitung total omzet dari semua data
    const total = orders.reduce((acc, curr) => acc + curr.total, 0);

    // Menghitung jumlah transaksi unik
    const count = orders.length;

    // Menghitung sisa pembayaran yang belum lunas
    const unpaid = orders
        .filter(o => o.bayar === "Belum Bayar")
        .reduce((acc, curr) => acc + curr.total, 0);

    // Update elemen dashboard sesuai screenshot kamu
    document.getElementById('totalOmzet').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('totalOrderCount').innerText = `${count} Transaksi`;
    document.getElementById('unpaidAmount').innerText = `Rp ${unpaid.toLocaleString('id-ID')}`;
}

function showToast(message, type = 'success') {
    // 1. Buat container jika belum ada
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 2. Buat elemen toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Pilih ikon berdasarkan tipe
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

    toast.innerHTML = `
        <i class="fas ${icon}" style="color: ${type === 'success' ? '#10b981' : '#ef4444'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // 3. Hapus otomatis setelah 3 detik
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-in forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}


function kirimWA(id) {
    const o = orders.find(x => x.id === id);
    if (!o.telp || o.telp === "undefined") return alert("Nomor WA tidak ditemukan!");

    let p = o.telp.startsWith('0') ? '62' + o.telp.slice(1) : o.telp;

    // Membuat format teks seperti struk fisik
    const pesanStruk =
        `*--- ${currentUser.name.toUpperCase()} ---*
ID Order : #${o.id}
Nama     : ${o.nama}
-------------------------------
Layanan  : ${o.layanan}
Jenis    : ${o.jenis}
Berat    : ${o.berat} kg
Status   : ${o.status.toUpperCase()}
Bayar    : ${o.bayar.toUpperCase()}
-------------------------------
*TOTAL    : Rp ${Math.round(o.total).toLocaleString()}*
-------------------------------
Terima kasih telah mempercayakan pakaian Anda kepada kami!`;

    window.open(`https://wa.me/${p}?text=${encodeURIComponent(pesanStruk)}`, '_blank');
}

function cetakStruk(id) {
    const o = orders.find(x => x.id === id);
    const tglSelesai = new Date();
    // Estimasi selesai sederhana
    const tambahanHari = o.layanan === "Express" ? 1 : (o.layanan === "Fast" ? 2 : 3);
    tglSelesai.setDate(tglSelesai.getDate() + tambahanHari);

    const printWindow = window.open('', '_blank', 'width=450,height=800');
    printWindow.document.write(`
        <html>
        <head>
            <title>Struk Digital - #${o.id}</title>
            <style>
                body { background-color: #f3f4f6; display: flex; justify-content: center; padding: 20px; margin: 0; }
                .receipt-card { 
                    background: white; width: 80mm; padding: 15px; 
                    box-shadow: 0 0 10px rgba(0,0,0,0.1); color: #000;
                    font-family: 'Courier New', Courier, monospace;
                }
                @media print {
                    body { background: none; padding: 0; display: block; }
                    .receipt-card { box-shadow: none; margin: 0 auto; width: 100%; max-width: 80mm; }
                }
                .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 10px; margin-bottom: 10px; }
                .header h2 { margin: 0; font-size: 18px; }
                .info-table, .item-table { width: 100%; font-size: 12px; border-collapse: collapse; }
                .item-table th { border-bottom: 1px dashed #000; padding: 5px 0; text-align: left; }
                .item-table td { padding: 5px 0; }
                .total-box { text-align: right; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
                .footer { text-align: center; font-size: 10px; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
                .qr-code { margin-top: 15px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="receipt-card">
                <div class="header">
                    <h2>${currentUser.name.toUpperCase()}</h2>
                    <p style="font-size: 10px; margin: 5px 0;">Jl. Perintis Kemerdekaan, Makassar</p>
                    <p style="font-size: 11px; font-weight: bold;">ID: #${o.id}</p>
                </div>

                <table class="info-table">
                    <tr><td>Tgl Masuk :</td><td align="right">${new Date().toLocaleDateString('id-ID')}</td></tr>
                    <tr><td>Tgl Keluar:</td><td align="right">~ ${tglSelesai.toLocaleDateString('id-ID')}</td></tr>
                    <tr><td>Pelanggan :</td><td align="right">${o.nama}</td></tr>
                    <tr><td>WhatsApp  :</td><td align="right">${o.telp}</td></tr>
                    <tr><td>Kasir     :</td><td align="right">${currentUser.username || 'Admin'}</td></tr>
                </table>

                <table class="item-table" style="margin-top: 10px;">
                    <thead>
                        <tr><th>ITEM/LAYANAN</th><th align="right">QTY/BRT</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${o.jenis} (${o.layanan})</td>
                            <td align="right">${o.berat} kg</td>
                        </tr>
                        <tr>
                            <td colspan="2" style="font-size: 10px; color: #555;">Status: ${o.status} | Pembayaran: ${o.bayar}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total-box">
                    ${o.berat > 10 ? '<span style="font-size: 10px;">Diskon Member 10%: Berlaku</span><br>' : ''}
                    <span style="font-size: 11px;">GRAND TOTAL:</span><br>
                    <span style="font-size: 20px; font-weight: bold;">Rp ${Math.round(o.total).toLocaleString('id-ID')}</span>
                </div>

                <div class="qr-code">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://wa.me/${o.telp}" alt="QR WA">
                    <p style="font-size: 8px; margin-top: 5px;">Scan untuk cek status via WhatsApp</p>
                </div>

                <div class="footer">
                    * TERIMA KASIH *<br>
                    Barang yang sudah diambil tidak dapat ditukar.<br>
                    Simpan struk ini sebagai bukti pengambilan.<br>
                    - - - - - - - - ✂ - - - - - - - -
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function cetakLaporanBulanan() {
    const sekarang = new Date();
    const bulanSekarang = sekarang.getMonth();
    const tahunSekarang = sekarang.getFullYear();
    const namaBulan = sekarang.toLocaleString('id-ID', { month: 'long' });

    // 1. Filter data berdasarkan bulan & tahun transaksi (berdasarkan ID timestamp)
    const dataBulanIni = orders.filter(o => {
        const tglOrder = new Date(o.id);
        return tglOrder.getMonth() === bulanSekarang && tglOrder.getFullYear() === tahunSekarang;
    });

    if (dataBulanIni.length === 0) {
        return showToast("Tidak ada data transaksi untuk bulan ini", "error");
    }

    // 2. Hitung Ringkasan
    const totalOmzet = dataBulanIni.reduce((s, o) => s + o.total, 0);
    const totalLunas = dataBulanIni.filter(o => o.bayar === "Lunas").reduce((s, o) => s + o.total, 0);
    const totalPiutang = totalOmzet - totalLunas;

    // 3. Generate HTML untuk Jendela Cetak
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Laporan Bulanan - ${namaBulan} ${tahunSekarang}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f2f2f2; }
                .summary { margin-top: 30px; float: right; width: 300px; }
                .summary-item { display: flex; justify-content: space-between; padding: 5px 0; }
                .total { font-weight: bold; border-top: 1px solid #333; margin-top: 5px; padding-top: 5px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>LAPORAN PENDAPATAN BULANAN</h2>
                <h3>${currentUser.name.toUpperCase()}</h3>
                <p>Periode: ${namaBulan} ${tahunSekarang}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Tgl</th>
                        <th>Pelanggan</th>
                        <th>Layanan</th>
                        <th>Status</th>
                        <th>Pembayaran</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${dataBulanIni.map(o => `
                        <tr>
                            <td>${new Date(o.id).toLocaleDateString('id-ID')}</td>
                            <td>${o.nama}</td>
                            <td>${o.jenis} (${o.layanan})</td>
                            <td>${o.status}</td>
                            <td>${o.bayar}</td>
                            <td>Rp ${Math.round(o.total).toLocaleString('id-ID')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="summary">
                <div class="summary-item"><span>Total Transaksi:</span> <span>${dataBulanIni.length}</span></div>
                <div class="summary-item"><span>Total Omzet:</span> <span>Rp ${Math.round(totalOmzet).toLocaleString('id-ID')}</span></div>
                <div class="summary-item"><span>Uang Masuk (Lunas):</span> <span>Rp ${Math.round(totalLunas).toLocaleString('id-ID')}</span></div>
                <div class="summary-item"><span>Piutang:</span> <span style="color:red;">Rp ${Math.round(totalPiutang).toLocaleString('id-ID')}</span></div>
                <div class="summary-item total"><span>NET INCOME:</span> <span>Rp ${Math.round(totalLunas).toLocaleString('id-ID')}</span></div>
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function changeTab(t) {
    currentTab = t;
    document.getElementById('tabActive').classList.toggle('active', t === 'active');
    document.getElementById('tabDone').classList.toggle('active', t === 'done');
    renderTable();
}