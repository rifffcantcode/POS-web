const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const midtransClient = require("midtrans-client");
const admin = require("firebase-admin");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors({ origin: "*" }));
app.use(express.json());

// ================= FIREBASE INIT =================
const serviceAccount = {
  "type": "service_account",
  "project_id": "sistemkasirtokocom",
  "private_key_id": "c926d0c3a849637d42c91448df852b6c9126aae1",
  "private_key": process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDEcGpNvK8I2n3C\ngAL6L8SmNHVpq1vw7SmlSQeWLsYog9pIjTIGmqisRr4xDSSA1qlbpjD1L3RYW5Og\ncXR1giu1+gvr5TVz0zGTbr5Ob9C2eFdCd/CmQFTI3JVS8HLNH5TGxNzeMsvMaN8C\nDt+GVJKtAhLnaDj7d/UhflSBeMI7fWpJd9azW4/pCyQM/xYQDRFJYeZz+Md7qidx\nlE37pY5VsrYny7gNtYgzISGndbIWTgIIZIzBFjP1SnCsDOEouVRDo47md/sb9NAL\n1+X6JTJHo/lzDyOzUCkOn+d30QNFrBp/zZZOOtAexJq4NxQt6yDVzI9RaULZePiX\n6lg9T3irAgMBAAECggEAA81bOWL4DldQTNX2eMo457CnPyLadjjY8AKQW4dPPZSD\nwpi9CaSvtBnwb3meJcJB5+y5EN3YxicLnfTkOKwK1Yxf87JtjO7fDEf99f2zD/0X\nT0mMBmPDYFnoqADQcAj287v2vHRGPpAfFOady/dSGXgrToBVbgSd4YaU8yaXt9gG\nZJuqjM4R3LLW0MyOcilwqTtTxe7OChmQYqav8yN6Pk/pRPzAGrYumlpYwJ32LInc\nutOIw76QF66jP3oIWUuVQHHmv6hUadOtILyk3nGob9ebShXscY826dUyjAdYK9Cg\nKOKX3CJzlDl+uMVt7pxkLiecUDNdTiKfZcyBx4UZlQKBgQDxlz9UUweVPK3SI6qR\n89fk73Frl5LIu/FKBfEenxkWcu53TBbnwTPx+of+O7D43eGGXRYyuTSKQ7dG4AQh\nQro4Zc88xw9Q4gQwFz+21O1WiOdfWz/OjT1tdi32kEpxxFT4ztqQ8Itzof6G3pba\nI45MvR7cBj8GnbtR0cV4OASL/QKBgQDQJ8PUUXh5QcQ953BRG7nmsOxXfbt39Prc\nXjPDhwuIk+1mIaFrzbWxJ/VyVlVDkDSG1O1csvP1uk6pa7Zx7rAwv6CeF+0KQf6P\nHx9G1zZElkOwdJnYoigHkY+hv3zXTOjyXSVS6spcc61dwspdWYJOlnNIKz4c2foW\nflFb7bRzxwKBgQCPmODRlFCLifefUgfOnOuUbiYyV3Ot0NhIsWNyWgqlZ0cKrbVn\np1Ti3ZD7sissoWWtYaMSHzd1f25uuDR8OJdLcmhNrdwSrWTj2M3MNJ+lsdYkva4d\nbaI3b+k+BuHY4WPIR9tuDyw0XPNW4vMzUbMBNeAj06qemh5/MXp4TIOXWQKBgQCT\nu3U4Di5z2OJfkQ/c8NGq0eybV8gipgMZPd59Ki5cW6jEsJ+xNEl8l0CTSoSvM/yj\nqSFhhjyxLO5BPgo5qE7x+j8TlSWN/zKc/1iiXYHNgdw+szKxVr0UShHnmVEQOSyn\nPsaLp8nBffQQNHyNbkaWYh8lnFM0BNyC9Fnn5bgJ5wKBgEGbWV/XEKHRwcQnZsiS\nsLrlU3g43H5q1SBPL9Z8Dsd4RLb9xLaDlxZKz93rhuzzq0AvujykXwBHmT/nAHk3\nPSPRR+dI1ZnzEycEUgKkgOODxzN57B7kHW+I++uICLCWjZ0nJghRfNnfUmE/P8LZ\nnDmJeKWIwbEWJFINIV+wlDDC\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@sistemkasirtokocom.iam.gserviceaccount.com",
  "client_id": "111135853134964169062",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40sistemkasirtokocom.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ================= MIDTRANS INIT =================
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

if (!process.env.MIDTRANS_SERVER_KEY) {
  console.error("MIDTRANS_SERVER_KEY tidak ditemukan. Pastikan backend/.env berisi kunci Midtrans yang valid.");
}

// ================= CREATE TRANSACTION =================
app.post("/create-transaction", async (req, res) => {
  try {
    console.log("CREATE TRANSACTION");

    // FIX DUPLIKAT: Terima juga customerName & customerPhone dari client
    // agar dokumen Firestore langsung lengkap sejak awal (tidak perlu ditulis ulang oleh client)
    const { cart, orderId, userId, customerName, customerPhone, paymentMethod } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: "Cart kosong" });
    }

    const total = cart.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const finalOrderId = orderId || "INV-" + Date.now();

    const parameter = {
      transaction_details: {
        order_id: finalOrderId,
        gross_amount: total,
      },
      credit_card: {
        secure: true,
      },
      item_details: cart.map((item) => ({
        id: item.id || item.name,
        price: item.price,
        quantity: item.quantity,
        name: item.name,
      })),
      customer_details: {
        first_name: customerName || "Customer",
      },
    };

    const transaction = await snap.createTransaction(parameter);

    console.log("TX CREATED:", finalOrderId);

    // FIX DUPLIKAT: Simpan dokumen LENGKAP sejak awal dengan status "pending".
    // Saat pembayaran sukses, client hanya perlu UPDATE status dokumen ini menjadi "success"
    // via /update-status-by-token — TIDAK perlu addDoc baru dari client.
    await db.collection("sales").add({
      orderId: finalOrderId,
      userId: userId || "guest",
      customerName: customerName || "-",
      customerPhone: customerPhone || "-",
      paymentMethod: paymentMethod || "non-cash",
      cashReceived: 0,
      change: 0,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0,
        subtotal: Number(item.price) * Number(item.quantity),
      })),
      itemCount: cart.length,
      totalAmount: total,
      total,
      status: "pending",
      snapToken: transaction.token,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiredAt: Date.now() + 15 * 60 * 1000,
    });

    // Beri tahu client bahwa dokumen sudah tersimpan di server
    // sehingga client bisa skip saveSaleRecord() dan hanya update status
    res.json({ token: transaction.token, saved: true });

  } catch (error) {
    console.error("ERROR CREATE TX:", error);
    res.status(500).json({ error: "Gagal create transaksi" });
  }
});

// ================= UPDATE STATUS BY TOKEN =================
app.post("/update-status-by-token", async (req, res) => {
  try {
    const { token, status } = req.body;

    const snapshot = await db
      .collection("sales")
      .where("snapToken", "==", token)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Token tidak ditemukan" });
    }

    const batch = db.batch();

    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    res.json({ success: true });

  } catch (error) {
    console.error(" ERROR UPDATE STATUS:", error);
    res.status(500).json({ error: "Gagal update status" });
  }
});

// ================= MIDTRANS WEBHOOK =================
app.post("/midtrans-webhook", async (req, res) => {
  try {
    const notif = req.body;

    const orderId = notif.order_id;
    const status = notif.transaction_status;

    console.log(" WEBHOOK:", orderId, status);

    let finalStatus = "pending";

    if (status === "settlement") finalStatus = "success";
    else if (status === "expire" || status === "cancel") finalStatus = "failed";

    const snapshot = await db
      .collection("sales")
      .where("orderId", "==", orderId)
      .get();

    const batch = db.batch();

    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        status: finalStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    res.sendStatus(200);

  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    res.sendStatus(500);
  }
});

// ================= CANCEL TRANSACTION =================
app.post("/cancel-transaction", async (req, res) => {
  try {
    const { orderId } = req.body;

    const snapshot = await db
      .collection("sales")
      .where("orderId", "==", orderId)
      .get();

    const batch = db.batch();

    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        status: "failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    res.json({ success: true });

  } catch (error) {
    console.error("CANCEL ERROR:", error);
    res.status(500).json({ error: "Gagal cancel transaksi" });
  }
});

// ================= DELETE TRANSACTION =================
app.post("/delete-transaction", async (req, res) => {
  try {
    const { docId } = req.body;

    if (!docId) {
      return res.status(400).json({ error: "docId diperlukan" });
    }

    await db.collection("sales").doc(docId).delete();

    res.json({ success: true });

  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ error: "Gagal hapus transaksi" });
  }
});

// ================= GET ALL SALES (UNTUK LAPORAN) =================
app.get("/sales", async (req, res) => {
  try {
    const snapshot = await db
      .collection("sales")
      .orderBy("createdAt", "desc")
      .get();

    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(data);

  } catch (error) {
    console.error("ERROR GET SALES:", error);
    res.status(500).json({ error: "Gagal ambil data sales" });
  }
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("API LUMINA RUNNING");
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});