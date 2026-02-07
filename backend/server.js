const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Tentukan lokasi file database JSON
const DB_PATH = path.join(__dirname, 'database.json');
const ACCOUNTS_PATH = path.join(__dirname, 'account.json');

// Fungsi helper untuk baca data dari file
const readDB = (targetPath = DB_PATH) => {
    if (!fs.existsSync(targetPath)) {
        const initialData = targetPath === ACCOUNTS_PATH ? {} : []; 
        fs.writeFileSync(targetPath, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    const data = fs.readFileSync(targetPath, 'utf-8');
    return JSON.parse(data);
};

// Fungsi helper untuk tulis data ke file
const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

// --- API LOGIN ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const accounts = readDB(ACCOUNTS_PATH);

    // DEBUG: Cek di terminal apa yang masuk
    console.log("Login Attempt:", { username, password });
    console.log("Available Accounts:", accounts);

    if (accounts[username] && accounts[username].pass === password) {
        // Jangan kirim password balik ke client
        const { pass, ...userData } = accounts[username];
        res.json({ success: true, user: userData });
    } else {
        res.status(401).json({ success: false, message: "Username atau Password salah!" });
    }
});

// GET: Ambil semua data
app.get('/api/orders', (req, res) => {
    const orders = readDB();
    res.json(orders);
});

// POST: Simpan data baru
app.post('/api/orders', (req, res) => {
    const orders = readDB();
    const newOrder = { 
        id: Date.now(), // Tambah ID unik pakai timestamp
        ...req.body 
    };
    
    orders.push(newOrder);
    writeDB(orders); // Simpan ke file database.json
    
    res.status(201).json({ message: 'Order berhasil disimpan secara permanen!', data: newOrder });
});

// PUT: Update status cucian
app.get('/api/orders/update/:id', (req, res) => {
    const orders = readDB();
    const { id } = req.params;
    const index = orders.findIndex(o => o.id == id);

    if (index !== -1) {
        const STATUS_FLOW = ["Menunggu", "Dicuci", "Dikeringkan", "Disetrika", "Selesai"];
        let currentIdx = STATUS_FLOW.indexOf(orders[index].status);
        
        if (currentIdx < STATUS_FLOW.length - 1) {
            orders[index].status = STATUS_FLOW[currentIdx + 1];
            writeDB(orders);
            return res.json({ message: 'Status diperbarui!', data: orders[index] });
        }
    }
    res.status(404).json({ message: 'Order tidak ditemukan atau sudah selesai' });
});

// Endpoint untuk ganti status bayar (Lunas/Belum Bayar)
app.get('/api/orders/pay/:id', (req, res) => {
    const orders = readDB();
    const { id } = req.params;
    const index = orders.findIndex(o => o.id == id);

    if (index !== -1) {
        // Logika Toggle: Jika Lunas jadi Belum Bayar, dan sebaliknya
        orders[index].bayar = (orders[index].bayar === "Lunas") ? "Belum Bayar" : "Lunas";
        writeDB(orders); // Simpan ke database.json
        return res.json({ message: 'Status bayar diperbarui!', data: orders[index] });
    }
    res.status(404).json({ message: 'Order tidak ditemukan' });
});

// DELETE: Hapus order dari database
app.delete('/api/orders/:id', (req, res) => {
    let orders = readDB();
    const { id } = req.params;
    
    const filteredOrders = orders.filter(o => o.id != id);
    
    if (orders.length !== filteredOrders.length) {
        writeDB(filteredOrders);
        return res.json({ message: 'Order berhasil dihapus!' });
    }
    res.status(404).json({ message: 'Order gagal dihapus' });
});


app.listen(PORT, () => {
    console.log(`Server jalan di http://192.168.1.3:${PORT}`);
});