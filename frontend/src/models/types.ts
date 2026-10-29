export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

export interface Commande {
  id: string;
  status: string;
  total: number;
}