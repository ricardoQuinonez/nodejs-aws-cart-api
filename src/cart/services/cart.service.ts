import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cart, CartStatuses } from '../models';
import { PutCartPayload } from 'src/order/type';
import { Repository } from 'typeorm';
import { CartEntity } from '../entities/cart.entity';
import { CartItemEntity } from '../entities/cart-item.entity';
import { ProductEntity } from '../entities/product.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private cartRepository: Repository<CartEntity>,
    @InjectRepository(CartItemEntity)
    private cartItemRepository: Repository<CartItemEntity>,
    @InjectRepository(ProductEntity)
    private productRepository: Repository<ProductEntity>,
  ) {}

  async findByUserId(userId: string, optWhere: {} = {
      status: CartStatuses.OPEN
    }): Promise<Cart | null> {
    const cartEntity = await this.cartRepository.findOne({
      where: {
        user_id: userId,
        ...optWhere
      },
      relations: ['items', 'items.product']
    });

    if (!cartEntity) {
      return null;
    }
    return this.mapEntityToModel(cartEntity);
  }

  async createByUserId(user_id: string): Promise<Cart> {
    const cartEntity = this.cartRepository.create({
      user_id,
      status: CartStatuses.OPEN,
      items: [],
    });
    const savedCartEntity = await this.cartRepository.save(cartEntity);
    return this.mapEntityToModel(savedCartEntity);
  }

  async findOrCreateByUserId(userId: string, optWhere?: {}): Promise<Cart> {
    const userCart = await this.findByUserId(userId, optWhere);

    if (userCart) {
      return userCart;
    }

    return await this.createByUserId(userId);
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<Cart> {
    const { product, count } = payload;

    let cartEntity = await this.cartRepository.findOne({
      where: { user_id: userId, status: CartStatuses.OPEN },
      relations: ['items', 'items.product'],
    });

    if (!cartEntity) {
      cartEntity = this.cartRepository.create({
        user_id: userId,
        status: CartStatuses.OPEN,
        items: [],
      });
      cartEntity = await this.cartRepository.save(cartEntity);
      cartEntity.items = [];
    }

    const productEntity = await this.productRepository.save({
      product_id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
    });

    cartEntity.items = cartEntity.items ?? [];
    let cartItem = cartEntity.items.find(
      (item) => item.product_id === product.id,
    );

    if (count <= 0) {
      if (cartItem) {
        await this.cartItemRepository.delete({
          cart_id: cartEntity.id,
          product_id: product.id,
        });
        cartEntity.items = cartEntity.items.filter(
          (item) => item.product_id !== product.id,
        );
      }
    } else if (cartItem) {
      cartItem.count = count;
      cartItem = await this.cartItemRepository.save(cartItem);
    } else {
      cartItem = this.cartItemRepository.create({
        cart_id: cartEntity.id,
        product_id: product.id,
        count,
        cart: cartEntity,
        product: productEntity,
      });
      cartItem = await this.cartItemRepository.save(cartItem);
      cartEntity.items.push(cartItem);
    }

    const updatedCartEntity = await this.cartRepository.findOne({
      where: { id: cartEntity.id },
      relations: ['items', 'items.product'],
    });

    if (!updatedCartEntity) {
      throw new Error('Cart not found after update');
    }

    return this.mapEntityToModel(updatedCartEntity);
  }

  async removeByUserId(userId: string): Promise<void> {
    const cartEntity = await this.cartRepository.findOne({
      where: { user_id: userId, status: CartStatuses.OPEN },
      relations: ['items'],
    });

    if (!cartEntity) {
      return;
    }

    cartEntity.status = CartStatuses.ORDERED;
    await this.cartRepository.save(cartEntity);
  }

  private mapEntityToModel(entity: CartEntity): Cart {
    return {
      id: entity.id,
      user_id: entity.user_id,
      created_at: entity.created_at.getTime(),
      updated_at: entity.updated_at.getTime(),
      status: entity.status,
      items: (entity.items ?? []).map((item) => ({
        product: {
          id: item.product.product_id,
          title: item.product?.title ?? '',
          description: item.product?.description ?? '',
          price: item.product?.price ?? 0,
        },
        count: item.count,
      })),
    };
  }
}
