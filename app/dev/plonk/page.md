---
title: zkSNARKs and PLONK
---

## Overview

[zkSNARKs][zksnarks] are modern cryptography primitives that prove the correct execution of an
arbitrary computation without the need for a verifier to re-execute that computation. In addition to
that, zkSNARKs have the ability to keep part of the computation secret (or rather, to reveal only
specific parts).

Modern blockchains use zkSNARKs to prove the correct execution of a smartcontract endpoint, for
example.

The acronym "zkSNARK" stands for **Z**ero-**K**nowledge **S**uccinct **N**on-interactive
**Ar**gument of **K**nowledge:

- **zero-knowledge** means the computation is not revealed, except for the parts the prover chooses
  to reveal;
- **succinct** means the size of the proof is sublinear in the size of the original computation (in
  fact, the zkSNARK scheme used in Libernet results in constant-size proofs of about 1 KiB each);
- **non-interactive** means the verification protocol does not require a challenge-response
  round-trip;
- **argument of knowledge** indicates that the prover really had the full trace of the computation,
  notwithstanding all the above requirements.

Libernet uses zkSNARKs in a few different contexts, for example anonymous payments towards incognito
accounts. Our zkSNARK protocol is based on [KZG polynomial commitments][kzg] over the BLS12-381
elliptic curve and [PLONK arithmetization][plonk].

This page describes the full PLONK protocol that we use in Libernet in detail, but it assumes
knowledge of KZG. Be sure to understand everything in [Dankrad Feist's article][kzg] before moving
on.

## Circuits

In the zkSNARK world a computation is encoded as a conceptual circuit with gates and wires. The
gates represent basic arithmetic operations such as addition and multiplication, and the wires
connect the inputs and outputs of the gates.

As an example, consider the following circuit:

![A sample zkSNARK circuit.](/circuit.png)

It's easy to see how it encodes the computation of $x^3 + x + 5$. A prover with this circuit could
produce a zkSNARK cryptographic proof that can convince a verifier of a statement like _"I have a
secret number $x$ such that $x^3 + x + 5 = 35$"_, wihtout revealing $x$. This is a simple example so
it's easy to find out that this number would be $x = 3$, but zkSNARKs enable complex protocols such
as anonymous voting and payments where some elements of the computation remain secret.

## Evaluation Domain and Polynomial Interpolation

Libernet uses the BLS12-381 elliptic curve, so all of its zkSNARK circuits are evaluated on the
scalar field of that curve. The scalar field of BLS12-381 has the following ~256 bit order:

```
r = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
```

So the values carried by the wires of our circuits are ~256 bit integers.

In zkSNARKs we encode all computation in **polynomials**. To see how a polynomial can encode an
ordered list of integers, consider the following list of integer pairs:

```
(0, 33)
(1, 10)
(2, 24)
(3, 49)
```

To encode the ordered list of integers `[33, 10, 24, 49]` we can use a polynomial that crosses the
points represented by the above pairs. This is achieved by **polynomial interpolation**.

There are two distinct approaches to implement polynomial interpolation:
[**Lagrange interpolation**][lagrange] and the [**Fast Fourier Transform**][fft]. Algorithms based
on Lagrange interpolation take $O(N^2)$ time where $N$ is the number of points to interpolate, so in
Libernet we use the Fast Fourier Transform which takes $O(N \cdot log(N))$ time. However, some parts
of our PLONK protocol also use Lagrange basis polynomials for other purposes (more on that later).

The Fast Fourier Transform algorithm is significantly faster than Lagrange interpolation but has two
important restrictions:

- the number on interpolated points must be a power of 2,
- and the X coordinates of the points cannot have arbitrary values, they must be **powers of an N-th
  root of unity**.

As a quick refresher, **an $N$-th root of unity** is a number $\omega$ such that $\omega^N = 1$.
When working with standard math tools the $\omega^N = 1$ equation has exactly $N$ complex solutions,
only one of which is a real number ($\omega = 1$). In modular arithmetic things work differently,
but since the BL12-381 scalar field has prime order [Fermat's Little Theorem][fermat] shows us that
the equation can still be satisfied. In fact, the field has the following well-known $2^{32}$-th
root of unity:

```
0x16a2a19edfe81f20d09b681922c813b4b63683508c2280b93829971f439f0d2b
```

There are $2^{32}$ different powers of this number, allowing us to interpolate at most $2^{32}$ (or
4,294,967,296) points using the Fast Fourier Transform. From there we can adapt the FFT algorithm to
run on any number of points that's a power of two less than or equal to $2^{32}$. Let $k$ be this
number:

$$
k = 2^h, 0 < h \leq 32
$$

We can obtain a $k$-th root of unity $\omega_0$ from the $N$-th root of unity $\omega$ as follows:

$$
\omega_0 = \omega^{2^{32-h}}
$$

In fact:

$$
\omega_0^k =
(\omega^{2^{32 - h}})^k =
\omega^{2^h \cdot 2^{32 - h}} =
\omega^{2^{32 - h + h}} =
\omega^{2^{32}} = 1
$$

As a consequence of the above, and given the necessity to encode our computation in a series of
polynomials as quickly as possible, we'll often work with powers of $\omega_0$ rather than plain
naturals as our evaluation domain. Instead of encoding the following points:

```
(0, 33)
(1, 10)
(2, 24)
(3, 49)
```

we'll use the FFT algorithm to encode the following points:

```
(w0^0, 33)
(w0^1, 10)
(w0^2, 24)
(w0^3, 49)
```

where `w0` is a $k$-th root of unity $\omega_0$.

> [!NOTE]
> in the following we will simply use $\omega$ to indicate the $k$-th root of unity, not the $N$-th.

The Fast Fourier Transform and other algorithms on polynomials are implemented in [the `poly` module
of our `crypto` library][crypto-poly].

## Witness and Constraints

TODO

## Gate Constraints

TODO

## Wire Constraints

TODO

## Putting It All Together

TODO

[crypto-poly]: https://github.com/libernet-mirror/crypto/blob/main/src/poly.rs
[fermat]: https://en.wikipedia.org/wiki/Fermat%27s_little_theorem
[fft]: https://en.wikipedia.org/wiki/Fast_Fourier_transform
[kzg]: https://dankradfeist.de/ethereum/2020/06/16/kate-polynomial-commitments.html
[lagrange]: https://en.wikipedia.org/wiki/Lagrange_polynomial
[plonk]: https://eprint.iacr.org/2019/953.pdf
[zksnarks]: https://en.wikipedia.org/wiki/Non-interactive_zero-knowledge_proof
