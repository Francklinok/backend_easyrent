document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const messageEl = document.getElementById('message');

  if (!token) {
    messageEl.textContent = "Token non fourni.";
  } else {
    fetch(`http://192.168.1.66:3000/api/v1/auth/verify-email?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          messageEl.textContent = "Votre compte a été vérifié avec succès 🎉";
        } else {
          messageEl.textContent = data.message || "Échec de la vérification.";
        }
      })
      .catch(err => {
        console.error("Erreur lors de la vérification :", err);
        messageEl.textContent = "Erreur lors de la vérification.";
      });
  }
});
