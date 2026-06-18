'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── In-Memory Database ───────────────────────────────────────────────────────
// Simulates a real database for demonstration purposes.
// In production, replace with PostgreSQL/MongoDB client.

class InMemoryStore {
  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.carts = new Map();
    this.orders = new Map();
    this.sessions = new Map();
    this._seed();
  }

  _seed() {
    // Seed products
    const products = [
      {
        id: uuidv4(),
        name: 'Wireless Noise-Canceling Headphones',
        description: 'Premium audio with 30-hour battery life and active noise cancellation.',
        price: 299.99,
        category: 'Electronics',
        stock: 50,
        sku: 'ELEC-001',
        imageUrl: 'https://picsum.photos/seed/headphones/400/400',
        rating: 4.8,
        reviewCount: 1247,
        tags: ['audio', 'wireless', 'premium'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'Ergonomic Mechanical Keyboard',
        description: 'Tactile switches, RGB backlight, aluminium body. Built for developers.',
        price: 149.99,
        category: 'Peripherals',
        stock: 30,
        sku: 'PERI-001',
        imageUrl: 'https://picsum.photos/seed/keyboard/400/400',
        rating: 4.7,
        reviewCount: 892,
        tags: ['keyboard', 'mechanical', 'ergonomic'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: '4K Ultra-Wide Monitor',
        description: '34-inch curved IPS display, 144Hz refresh rate, HDR10 support.',
        price: 799.99,
        category: 'Electronics',
        stock: 15,
        sku: 'ELEC-002',
        imageUrl: 'https://picsum.photos/seed/monitor/400/400',
        rating: 4.9,
        reviewCount: 534,
        tags: ['monitor', '4k', 'ultrawide'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'Cloud Storage SSD 2TB',
        description: 'NVMe SSD with 7000MB/s read speed. Encrypted at rest.',
        price: 189.99,
        category: 'Storage',
        stock: 100,
        sku: 'STOR-001',
        imageUrl: 'https://picsum.photos/seed/ssd/400/400',
        rating: 4.6,
        reviewCount: 2103,
        tags: ['storage', 'ssd', 'fast'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'Smart Security Camera System',
        description: '4-camera 4K system with AI motion detection and 30-day cloud storage.',
        price: 449.99,
        category: 'Security',
        stock: 25,
        sku: 'SEC-001',
        imageUrl: 'https://picsum.photos/seed/camera/400/400',
        rating: 4.5,
        reviewCount: 678,
        tags: ['security', 'camera', 'smart-home'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'USB-C Docking Station Pro',
        description: '14-in-1 hub: Thunderbolt 4, dual 4K, 100W PD, Ethernet, SD card.',
        price: 129.99,
        category: 'Peripherals',
        stock: 60,
        sku: 'PERI-002',
        imageUrl: 'https://picsum.photos/seed/dock/400/400',
        rating: 4.4,
        reviewCount: 445,
        tags: ['hub', 'usb-c', 'thunderbolt'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    products.forEach(p => this.products.set(p.id, p));
  }
}

// Singleton instance
const store = new InMemoryStore();

module.exports = store;
