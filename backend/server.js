require("dotenv").config();

const express = require("express");
const cors = require("cors");
const midtransClient = require("midtrans-client");
const admin = require("firebase-admin");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors({ origin: "*" }));
app.use(express.json());

// ================= FIREBASE INIT =================
const serviceAccount = require("./config/sistemkasirtokocom-firebase-adminsdk-fbsvc-c926d0c3a8.json");

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
    console.log("🔥 CREATE TRANSACTION");

    const { cart, orderId, userId } = req.body;

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
        first_name: "Customer",
      },
    };

    const transaction = await snap.createTransaction(parameter);

    console.log("✅ TX CREATED:", finalOrderId);

    await db.collection("sales").add({
      orderId: finalOrderId,
      userId: userId || "guest",
      items: cart,
      total,
      status: "pending",
      snapToken: transaction.token,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiredAt: Date.now() + 15 * 60 * 1000, // 15 menit
    });

    res.json({ token: transaction.token });

  } catch (error) {
    console.error("❌ ERROR CREATE TX:", error);
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
    console.error("❌ ERROR UPDATE STATUS:", error);
    res.status(500).json({ error: "Gagal update status" });
  }
});

// ================= MIDTRANS WEBHOOK =================
app.post("/midtrans-webhook", async (req, res) => {
  try {
    const notif = req.body;

    const orderId = notif.order_id;
    const status = notif.transaction_status;

    console.log("🔔 WEBHOOK:", orderId, status);

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
    console.error("❌ ERROR GET SALES:", error);
    res.status(500).json({ error: "Gagal ambil data sales" });
  }
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("API LUMINA RUNNING 🚀");
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});