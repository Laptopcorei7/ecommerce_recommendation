import os

import numpy as np

# Load your model file
current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(
    current_dir, "hybrid_recommender_optimized.npz"
)

model = np.load(model_path, allow_pickle=True)

# Extract user IDs
user_to_idx = model["user_to_idx"].item()

# List all valid user IDs
valid_user_ids = list(user_to_idx.keys())

# Print how many and show a few examples
print(f"Total valid user IDs: {len(valid_user_ids)}")
print("Sample user IDs:")
print(valid_user_ids[:50])  # Show first 10
