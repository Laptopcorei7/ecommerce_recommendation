# Notebooks

`recc-system.ipynb` is the original 2025 model, kept as a record of the
submitted work. It is superseded by `ml_api/pipeline/`, which is what the
service actually trains from.

Do not rebuild the served model from this notebook. It has four defects that
the pipeline exists to avoid, documented in the "Notes on the rebuild" section
of the top-level README: two conflicting item orderings, a content term that
was the same constant for every user, a blend of two incompatible scales, and
an evaluation measuring a different predictor than the one that was served.

Its outputs were cleared before it was committed, so the metrics it once
printed are not recoverable from the file.
