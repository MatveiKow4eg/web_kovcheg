import { db } from "./firebase.js";
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

async function loadOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  const tbody = document.querySelector("#orders-table tbody");
  tbody.innerHTML = "";

  snapshot.forEach(doc => {
    const order = doc.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${order.id}</td>
      <td>${order.email}</td>
      <td>${order.total}</td>
      <td>${new Date(order.createdAt).toLocaleString()}</td>
      <td>${order.status}</td>
    `;
    tbody.appendChild(row);
  });
}

loadOrders();
