from datetime import datetime as dt
from typing import Optional
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    prompt: Mapped[str] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    mission_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    mission: Mapped[Optional["Mission"]] = relationship(
        "Mission",
        back_populates="proposal",
        uselist=False,
        primaryjoin="Proposal.id == Mission.proposal_id",
        viewonly=True,
    )


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    proposal_id: Mapped[str] = mapped_column(String, ForeignKey("proposals.id"), unique=True)
    title: Mapped[str] = mapped_column(String)
    goal: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="queued")
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_event: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    proposal: Mapped[Optional["Proposal"]] = relationship("Proposal", back_populates="mission", foreign_keys=[proposal_id])
    steps: Mapped[list["Step"]] = relationship("Step", back_populates="mission", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="mission", cascade="all, delete-orphan")


class Step(Base):
    __tablename__ = "steps"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    mission_id: Mapped[str] = mapped_column(String, ForeignKey("missions.id"))
    step_number: Mapped[int] = mapped_column(Integer)
    tool_name: Mapped[str] = mapped_column(String)
    input_json: Mapped[str] = mapped_column(Text)
    output_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    mission: Mapped["Mission"] = relationship("Mission", back_populates="steps")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    mission_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("missions.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String)
    payload_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    mission: Mapped[Optional["Mission"]] = relationship("Mission", back_populates="events")


class Policy(Base):
    __tablename__ = "policies"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    created_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
