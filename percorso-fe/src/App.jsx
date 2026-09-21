// percorso-fe/src/App.jsx
import { useEffect, useState } from 'react';

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(setAccounts)
      .catch(e => setError(e.message));
  }, []);

  return (
    <main>
      <h1>Lipari Accounts</h1>
      {error && <p style={{ color: 'crimson' }}>Errore: {error}</p>}
      <ul>
        {accounts.map(a => (
          <li key={a.id}>{a.iban} — €{a.balance}</li>
        ))}
      </ul>
    </main>
  );
}