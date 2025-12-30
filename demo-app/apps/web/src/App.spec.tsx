import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should render loading state initially', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<App />);

    expect(screen.getByText(/fetching environment info/i)).toBeInTheDocument();
  });

  it('should render PR info after successful fetch', async () => {
    const mockInfo = {
      pr: '123',
      commit: 'abc1234',
      branch: 'feature/test',
      version: '1.0.0',
      previewUrl: 'https://test.example.com',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockInfo),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('#123')).toBeInTheDocument();
    });

    expect(screen.getByText('feature/test')).toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
  });

  it('should render error state on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });
  });

  it('should display Live status badge', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}),
    );

    render(<App />);

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('should display app logo', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}),
    );

    render(<App />);

    expect(screen.getByText('k8s-ee')).toBeInTheDocument();
  });

  it('should render ephemeral environment badge', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}),
    );

    render(<App />);

    expect(screen.getByText('Ephemeral Environment')).toBeInTheDocument();
  });

  it('should handle HTTP error responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });

    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
  });

  it('should display tech stack badges in footer', async () => {
    const mockInfo = {
      pr: '1',
      commit: 'abc',
      branch: 'main',
      version: '1.0.0',
      previewUrl: 'https://example.com',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockInfo),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    expect(screen.getByText('k3s')).toBeInTheDocument();
    expect(screen.getByText('Helm')).toBeInTheDocument();
    expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
    expect(screen.getByText('Traefik')).toBeInTheDocument();
  });
});
