"""add grant_id to users

Revision ID: 0001
Revises:
Create Date: 2026-03-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("grant_id", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "grant_id")
