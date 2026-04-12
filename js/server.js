require("dotenv").config();

const express = require("express");
const cors = require("cors");
const midtransClient = require("midtrans-client");
const admin = require("firebase-admin");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= FIREBASE INIT =================
const serviceAccount = require("../config/sistemkasirtokocom-firebase-adminsdk-fbsvc-66445ad25e.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ================= MIDTRANS INIT =================
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

// ================= CREATE TRANSACTION =================
app.post("/create-transaction", async (req, res) => {
  try {
    const { cart, orderId, userId } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: "Cart kosong" });
    }

    const total = cart.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const finalOrderId = orderId || "INV-" + Date.now();

    console.log("🧾 Order ID:", finalOrderId);

    // 🔥 1. SIMPAN DULU KE FIRESTORE
    const docRef = await db.collection("sales").add({
      orderId: finalOrderId,
      userId: userId || "guest",
      items: cart,
      total,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiredAt: Date.now() + 15 * 60 * 1000,
    });

    console.log("✅ Saved to Firestore:", docRef.id);

    // 🔥 2. BARU KE MIDTRANS
    const parameter = {
      transaction_details: {
        order_id: finalOrderId,
        gross_amount: total,
      },
      credit_card: {
        secure: true,
      },
    };

    const transaction = await snap.createTransaction(parameter);

    // 🔥 3. UPDATE TOKEN
    await docRef.update({
      snapToken: transaction.token,
    });

    res.json({
      token: transaction.token,
    });

  } catch (error) {
    console.error("❌ ERROR CREATE TX:", error);
    res.status(500).json({ error: "Gagal create transaksi" });
  }
});

// ================= MIDTRANS WEBHOOK =================
app.post("/midtrans-webhook", async (req, res) => {
  try {
    const notif = req.body;

    const orderId = notif.order_id;
    const status = notif.transaction_status;

    console.log("🔔 Webhook:", orderId, status);

    let finalStatus = "pending";

    if (status === "settlement") finalStatus = "success";
    else if (status === "expire" || status === "cancel") finalStatus = "failed";

    // 🔥 update Firestore
    const snapshot = await db
      .collection("sales")
      .where("orderId", "==", orderId)
      .get();

    if (snapshot.empty) {
      console.warn("⚠️ Transaksi tidak ditemukan:", orderId);
    }

    snapshot.forEach((doc) => {
      doc.ref.update({
        status: finalStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.sendStatus(200);

  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
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

    snapshot.forEach((doc) => {
      doc.ref.update({
        status: "failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true });

  } catch (error) {
    console.error("❌ CANCEL ERROR:", error);
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
    console.error("❌ DELETE ERROR:", error);
    res.status(500).json({ error: "Gagal hapus transaksi" });
  }
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("🚀 API LUMINA RUNNING");
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});