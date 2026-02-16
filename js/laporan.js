import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. KONFIGURASI FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBMsUhXj-UCLLviXzweS1qXVdSaVgkDcu8",
    authDomain: "sistemkasirtokocom.firebaseapp.com",
    projectId: "sistemkasirtokocom",
    storageBucket: "sistemkasirtokocom.firebasestorage.app",
    messagingSenderId: "141722200955",
    appId: "1:141722200955:web:e07952808590aa7f582bde"
};

// 2. INISIALISASI
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let salesChart;

// 3. FUNGSI UNTUK MERENDER GRAFIK
function initChart(data) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Penjualan (Rp)',
                data: data.values,
                borderColor: '#1a2a40', 
                backgroundColor: 'rgba(212, 175, 55, 0.1)', 
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#d4af37',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a2a40',
                    callbacks: {
                        label: (context) => ` Total: Rp ${context.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f3f4f6' },
                    ticks: { callback: (value) => 'Rp ' + value.toLocaleString() }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// 4. FUNGSI UNTUK MEMANTAU STOK MENIPIS (REAL-TIME)
function watchLowStock() {
    const stockLimit = 5;
    const q = query(collection(db, "products"), where("stock", "<=", stockLimit));

    onSnapshot(q, (snapshot) => {
        const container = document.getElementById("low-stock-container");
        const list = document.getElementById("low-stock-list");
        
        if (snapshot.empty) {
            container.classList.add("hidden");
            return;
        }

        container.classList.remove("hidden");
        list.innerHTML = "";

        snapshot.forEach((doc) => {
            const product = doc.data();
            const colorClass = product.stock === 0 ? "bg-red-600" : "bg-orange-500";
            const statusText = product.stock === 0 ? "Habis" : `Sisa ${product.stock}`;

            list.innerHTML += `
                <div class="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-red-100 transition hover:shadow-md">
                    <div class="flex items-center gap-3">
                        <img src="${product.image || 'https://via.placeholder.com/50'}" class="w-10 h-10 rounded-lg object-cover" />
                        <div>
                            <p class="text-sm font-bold text-gray-800">${product.name}</p>
                            <p class="text-[10px] text-gray-400 uppercase">${product.category}</p>
                        </div>
                    </div>
                    <span class="${colorClass} text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">
                        ${statusText}
                    </span>
                </div>
            `;
        });
    });
}

// 5. FUNGSI UNTUK MEMUAT LAPORAN & FILTER
function loadReport(period = "all") {
    const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById("report-table-body");
        let totalRevenue = 0;
        let totalOrders = 0;
        let totalItemsSold = 0;
        const dailyData = {};
        
        tbody.innerHTML = "";

        const now = new Date();
        let startTime = new Date(0);

        if (period === "today") startTime = new Date(now.setHours(0,0,0,0));
        else if (period === "week") startTime = new Date(now.setDate(now.getDate() - 7));
        else if (period === "month") startTime = new Date(now.setMonth(now.getMonth() - 1));

        snapshot.forEach((doc) => {
            const data = doc.data();
            const ts = data.timestamp?.toDate();
            
            if (ts < startTime) return;

            totalRevenue += data.total;
            totalOrders++;

            const dateStr = ts ? ts.toLocaleDateString("id-ID") : "...";
            const timeStr = ts ? ts.toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'}) : "";

            if (ts) {
                const dayLabel = ts.toLocaleDateString("id-ID", { weekday: 'short', day: 'numeric' });
                dailyData[dayLabel] = (dailyData[dayLabel] || 0) + data.total;
            }

            const itemsSummary = data.items.map(i => {
                totalItemsSold += i.qty;
                return `${i.name} (x${i.qty})`;
            }).join(", ");

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition border-b border-gray-50">
                    <td class="p-5 font-medium text-gray-600">${dateStr} <span class="text-[10px] text-gray-400 block">${timeStr}</span></td>
                    <td class="p-5 font-mono text-xs font-bold text-gray-800">${data.trxId}</td>
                    <td class="p-5 text-gray-500 text-xs italic">${itemsSummary}</td>
                    <td class="p-5 text-right font-black text-gray-800">Rp ${data.total.toLocaleString()}</td>
                </tr>
            `;
        });

        document.getElementById("total-revenue").innerText = `Rp ${totalRevenue.toLocaleString()}`;
        document.getElementById("total-orders").innerText = totalOrders;
        document.getElementById("total-items").innerText = totalItemsSold;

        const labels = Object.keys(dailyData).reverse();
        const values = Object.values(dailyData).reverse();
        initChart({ labels, values });
    });
}

// 6. EVENT LISTENERS & INITIALIZATION
document.getElementById('period-filter').addEventListener('change', (e) => {
    loadReport(e.target.value);
});

// Jalankan semua fungsi
watchLowStock();
loadReport();