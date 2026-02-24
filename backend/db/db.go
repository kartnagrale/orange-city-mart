package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

// Connect initialises the pgx connection pool from the DATABASE_URL env var.
func Connect(ctx context.Context) error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("failed to parse DATABASE_URL: %w", err)
	}

	// Use simple protocol — required for Supabase transaction pooler (port 6543).
	// The transaction pooler does not support server-side prepared statements.
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err = pool.Ping(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	Pool = pool
	return nil
}
