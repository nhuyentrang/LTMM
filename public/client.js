let socket;
let keyPair;
let publicKeys = {};

async function register() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("Enter username");

  // Generate RSA key pair
  keyPair = await window.crypto.subtle.generateKey({
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  }, true, ["encrypt", "decrypt"]);

  const exportedKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));

  socket = new WebSocket(`wss://${location.host}`);
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "register", username, publicKey: publicKeyBase64 }));
    document.getElementById("chatArea").style.display = "block";
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "publicKey") {
      publicKeys[data.username] = data.publicKey;
    } else if (data.type === "message") {
      const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));
      const plaintext = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, keyPair.privateKey, ciphertext);
      const decoded = new TextDecoder().decode(plaintext);
      const box = document.getElementById("messages");
      box.innerHTML += `<div><strong>${data.from}:</strong> ${decoded}</div>`;
    }
  };
}

async function sendMessage() {
  const msg = document.getElementById("messageInput").value;
  for (let [user, pubBase64] of Object.entries(publicKeys)) {
    const pubBuf = Uint8Array.from(atob(pubBase64), c => c.charCodeAt(0));
    const pubKey = await crypto.subtle.importKey("spki", pubBuf.buffer, {
      name: "RSA-OAEP", hash: "SHA-256"
    }, true, ["encrypt"]);
    const encoded = new TextEncoder().encode(msg);
    const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, encoded);
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    socket.send(JSON.stringify({ type: "message", ciphertext: encryptedBase64 }));
  }
  document.getElementById("messageInput").value = "";
}
