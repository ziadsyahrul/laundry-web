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
    const btnId = 'btnLogin'; 
    const originalText = 'Masuk ke Sistem <i class="fas fa-sign-in-alt"></i>';

    if (!u || !p) {
        showToast("Username dan Password wajib diisi!", "error");
        return;
    }

    toggleLoading(btnId, true, originalText);

    try {
        // UPDATE: URL diganti menjadi relatif agar bisa jalan di Render
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('loggedUser', JSON.stringify(result.user));
            showToast("Login Berhasil!", "success");
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 800);
        } else {
            if (errorEl) errorEl.style.display = 'block';
            showToast(result.message || "Login Gagal", "error");
        }
    } catch (err) {
        showToast("Gagal terhubung ke server!", "error");
    } finally {
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
    const dashboard = document.getElementById('mainDashboard');
    if (dashboard) dashboard.style.display = 'block';

    const nameDisplay = document.getElementById('shopNameDisplay');
    if (nameDisplay) nameDisplay.innerText = `🧺 ${currentUser.name}`;

    setupDeleteEventListener();
    loadOrdersFromServer();
}

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

    if (!nama || !telp || isNaN(berat)) {
        return alert("Data tidak lengkap!");
    }

    toggleLoading(btnId, true);

    const orderBaru = {
        nama, telp, berat, jenis, layanan, bayar,
        status: "Menunggu",
        total: hitungHarga(berat, jenis, layanan),
        shopId: currentUser.id
    };

    try {
        // UPDATE: URL relatif
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderBaru)
        });

        if (response.ok) {
            showToast("Order berhasil disimpan!", "success");
            document.getElementById('nama').value = "";
            document.getElementById('telp').value = "";
            document.getElementById('berat').value = "";

            await loadOrdersFromServer(); 
        } else {
            throw new Error("Respon server tidak oke");
        }
    } catch (err) {
        showToast("Gagal menyimpan ke server", "error");
    } finally {
        toggleLoading(btnId, false, originalText);
    }
}

async function loadOrdersFromServer() {
    const list = document.getElementById('orderList');

    try {
        // UPDATE: URL relatif
        const response = await fetch('/api/orders');

        if (!response.ok) throw new Error("Gagal mengambil data dari server");

        const data = await response.json();
        orders = data.filter(item => item.shopId === currentUser.id);
        refreshUI();

    } catch (error) {
        console.error("Error:", error);
        if (list) {
            list.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 50px; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 15px;"></i><br>
                        <strong>Gagal terhubung ke server!</strong>
                    </td>
                </tr>`;
        }
    }
}

async function updateStatus(id) {
    try {
        // UPDATE: URL relatif
        const response = await fetch(`/api/orders/update/${id}`);
        if (response.ok) {
            loadOrdersFromServer();
        }
    } catch (err) {
        console.error("Gagal update status:", err);
    }
}

async function toggleBayar(id) {
    try {
        // UPDATE: URL relatif
        const response = await fetch(`/api/orders/pay/${id}`);
        
        if (response.ok) {
            showToast("Status pembayaran diperbarui!", "success");
            await loadOrdersFromServer(); 
        } else {
            throw new Error();
        }
    } catch (err) {
        showToast("Gagal memperbarui pembayaran", "error");
    }
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

    const chartCanvas = document.getElementById('laundryChart');
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    
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
    if (!list) return;
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

let orderIdToDelete = null; 

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
    orderIdToDelete = null;
}

function setupDeleteEventListener() {
    const btnConfirm = document.getElementById('btnConfirmDelete');
    if (!btnConfirm) return;

    btnConfirm.onclick = async function() {
        if (!orderIdToDelete) return;

        toggleLoading('btnConfirmDelete', true, 'Ya, Hapus');

        try {
            // UPDATE: URL relatif
            const response = await fetch(`/api/orders/${orderIdToDelete}`, {
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

function hapusOrder(id) {
    orderIdToDelete = id;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'flex';
}

function cariPelanggan() {
    const f = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('#orderList tr').forEach(r => {
        r.style.display = r.cells[1].innerText.toLowerCase().includes(f) ? "" : "none";
    });
}

function sortData() {
    const sortBy = document.getElementById('sortOrder').value;
    orders.sort((a, b) => {
        if (sortBy === 'newest') return b.id - a.id;
        if (sortBy === 'oldest') return a.id - b.id;
        if (sortBy === 'highest') return b.total - a.total;
        if (sortBy === 'lowest') return a.total - b.total;
    });
    renderTable();
}

function renderRekap() {
    const total = orders.reduce((acc, curr) => acc + curr.total, 0);
    const count = orders.length;
    const unpaid = orders.filter(o => o.bayar === "Belum Bayar").reduce((acc, curr) => acc + curr.total, 0);

    const omzetEl = document.getElementById('totalOmzet');
    const countEl = document.getElementById('totalOrderCount');
    const unpaidEl = document.getElementById('unpaidAmount');

    if (omzetEl) omzetEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;
    if (countEl) countEl.innerText = `${count} Transaksi`;
    if (unpaidEl) unpaidEl.innerText = `Rp ${unpaid.toLocaleString('id-ID')}`;
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

    toast.innerHTML = `
        <i class="fas ${icon}" style="color: ${type === 'success' ? '#10b981' : '#ef4444'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-in forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
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

function kirimWA(id) {
    const o = orders.find(x => x.id === id);
    if (!o || !o.telp || o.telp === "undefined") return alert("Nomor WA tidak ditemukan!");
    let p = o.telp.startsWith('0') ? '62' + o.telp.slice(1) : o.telp;
    const pesanStruk = `*--- ${currentUser.name.toUpperCase()} ---*\nID Order : #${o.id}\nNama : ${o.nama}\n-------------------------------\nLayanan : ${o.layanan}\nJenis : ${o.jenis}\nBerat : ${o.berat} kg\nStatus : ${o.status.toUpperCase()}\nBayar : ${o.bayar.toUpperCase()}\n-------------------------------\n*TOTAL : Rp ${Math.round(o.total).toLocaleString()}*\n-------------------------------\nTerima kasih!`;
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

function changeTab(t) {
    currentTab = t;
    const tabActive = document.getElementById('tabActive');
    const tabDone = document.getElementById('tabDone');
    if (tabActive) tabActive.classList.toggle('active', t === 'active');
    if (tabDone) tabDone.classList.toggle('active', t === 'done');
    renderTable();
}