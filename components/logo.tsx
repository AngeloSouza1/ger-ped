// components/logo.tsx
import Image from 'next/image';
import clsx from 'clsx';

type Props = {
  size?: number;
  className?: string;
  alt?: string;
};

export default function Logo({ size = 28, className, alt = 'Logo' }: Props) {
  return (
    <Image
      src="/logo.svg"
      alt={alt}
      width={size}
      height={size}
      priority
      className={clsx('inline-block', className)}
    />
  );
}
