export async function fetchRecommendations(userId: string, topN: number = 10) {
  const res = await fetch("http://127.0.0.1:8000/api/recommend/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, top_n: topN }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch recommendations");
  }

  return res.json();
}
