import { Entity, Column, OneToMany , PrimaryColumn} from 'typeorm';
import { CartItemEntity } from './cart-item.entity';

@Entity()
export class ProductEntity {
  @PrimaryColumn({ type: 'uuid',  nullable: false })
  product_id: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  price: number;

  @OneToMany(() => CartItemEntity, (cartItem) => cartItem.product)
  cartItems: CartItemEntity[];
}
