// lib/types.ts
export interface Customer {
    id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  }
  
  export interface OrderItem {
    productId?: string;
    name: string;
    unit?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }
  
  export interface OrderLike {
    id?: string;
    number: number | string;
    customer?: Customer | null;
    items: OrderItem[];
    total: number;
    notes?: string | null;
    createdAt?: string | Date;
  }
  