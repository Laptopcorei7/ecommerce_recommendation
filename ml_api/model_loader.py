# model_loader.py
import numpy as np
import scipy.sparse as sp


def load_model(file_path):
    data = np.load(file_path, allow_pickle=True)

    return {
        "user_factors": data["user_factors"],
        "item_factors": data["item_factors"],
        "user_bias": data["user_bias"],
        "item_bias": data["item_bias"],
        "global_mean": data["global_mean"].item(),
        "alpha": data["alpha"].item(),
        "user_to_idx": data["user_to_idx"].item(),
        "item_to_idx": data["item_to_idx"].item(),
        "idx_to_item": data["idx_to_item"].item(),
        "content_sim": sp.csr_matrix(
            (
                data["content_similarity_data"],
                data["content_similarity_indices"],
                data["content_similarity_indptr"],
            ),
            shape=tuple(data["content_similarity_shape"]),
        ),
    }
