"""remove grant_id from users (Nylas removed, replaced with direct OAuth)

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "grant_id")


def downgrade() -> None:
    op.add_column("users", sa.Column("grant_id", sa.Text(), nullable=True))
