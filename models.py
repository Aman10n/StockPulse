"""
Database models for the Smart Stock Monitoring Platform.
Uses SQLAlchemy ORM with SQLite backend.
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()


class Holding(Base):
    """Represents a single stock purchase entry."""
    __tablename__ = 'holdings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False, index=True)
    name = Column(String(100), nullable=True)
    sector = Column(String(50), nullable=True, default='Uncategorized')
    buy_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    date_purchased = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'ticker': self.ticker,
            'name': self.name,
            'sector': self.sector,
            'buy_price': round(self.buy_price, 2),
            'quantity': round(self.quantity, 4),
            'date_purchased': self.date_purchased,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Alert(Base):
    """Represents a price threshold alert (stop-loss or take-profit)."""
    __tablename__ = 'alerts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False, index=True)
    alert_type = Column(String(20), nullable=False)  # 'stop-loss' or 'take-profit'
    threshold_price = Column(Float, nullable=False)
    is_triggered = Column(Boolean, default=False)
    triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'ticker': self.ticker,
            'alert_type': self.alert_type,
            'threshold_price': round(self.threshold_price, 2),
            'is_triggered': self.is_triggered,
            'triggered_at': self.triggered_at.isoformat() if self.triggered_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Database initialization
# ---------------------------------------------------------------------------
DATABASE_URL = 'sqlite:///portfolio.db'

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(engine)


def get_db():
    """Yield a new database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
