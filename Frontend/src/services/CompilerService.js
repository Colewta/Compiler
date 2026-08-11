export async function compileCode(code) {
  const response = await fetch('http://localhost:8000/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code })
  });

  return response.json();
}