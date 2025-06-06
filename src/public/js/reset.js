document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetForm');
  const message = document.getElementById('message');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = document.getElementById('password').value;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      message.style.color = 'red';
      message.textContent = '❌ Jeton manquant dans l’URL.';
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, token }),
      });

      const data = await res.json();

      if (res.ok) {
        message.style.color = 'green';
        message.textContent = '✅ Mot de passe modifié avec succès.';
      } else {
        message.style.color = 'red';
        message.textContent = data.message || '❌ Erreur lors de la réinitialisation.';
      }
    } catch (err) {
      console.error(err);
      message.style.color = 'red';
      message.textContent = '❌ Une erreur est survenue.';
    }
  });
});
