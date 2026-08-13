"""Hermes Agent adapter for the DevMuse skill bundle."""

from pathlib import Path


def register(ctx):
    """Register DevMuse skills as explicit, namespaced Hermes skills."""
    skills_root = Path(__file__).parent / "plugin" / "skills"
    for skill_file in sorted(skills_root.glob("*/SKILL.md")):
        ctx.register_skill(
            name=skill_file.parent.name,
            path=skill_file,
        )
