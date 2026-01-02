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

It's easy to see how this encodes the computation of $x^3 + x + 5$. A prover with this circuit can
produce a zkSNARK cryptographic proof that convinces a verifier of a statement like _"I have a
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
ordered list of integers, consider the following list of pairs:

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

- the number of interpolated points must be a power of 2,
- and the X coordinates of the points cannot have arbitrary values, they must be **powers of an N-th
  root of unity**.

As a quick refresher, **an $N$-th root of unity** is a number $\omega$ such that $\omega^N = 1$. The
FFT algorithm requires the X-coordinates of the interpolated points to be:

$$
\omega^0, \omega^1, \omega^2, ..., \omega^{N - 1}
$$

where $N$ is a power of 2.

When working with standard math tools the $\omega^N = 1$ equation has exactly $N$ complex solutions,
only one of which is a real number ($\omega = 1$). In modular arithmetic things work differently,
but since the BL12-381 scalar field has prime order, [Fermat's Little Theorem][fermat] shows us that
the equation can still be satisfied. In fact, the field has the following well-known $2^{32}$-th
root of unity:

```
0x16a2a19edfe81f20d09b681922c813b4b63683508c2280b93829971f439f0d2b
```

There are $2^{32}$ different powers of this number, allowing us to interpolate at most $2^{32}$ (or
4,294,967,296) points using the Fast Fourier Transform. From there we can adapt the FFT algorithm to
run on any number of points $k$ that's a power of two less than or equal to $2^{32}$.

Let's define:

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
\omega^{2^{32 - h} \cdot 2^h} =
\omega^{2^{32 - h + h}} =
\omega^{2^{32}} = 1
$$

Given all the above, we'll often work with powers of $\omega_0$ rather than plain naturals as our
evaluation domain. Instead of encoding the following points:

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

where `w0` is a $k$-th root of unity $\omega_0$, in this case $k = 4$.

The Fast Fourier Transform and other algorithms on polynomials are implemented in [the `poly` module
of our `crypto` library][crypto-poly].

## Witnesses and Constraints

Proving the correct execution of an arbitrary computation takes the following steps:

1. both the prover and the verifier become aware of the same circuit (gates and wires);
2. the prover runs the computations, providing input values to the circuit, computing all
   intermediate values, and obtaining the output values;
3. the prover provides:
   a. a proof of knowledge of the above values;
   b. a proof that the above values satisfy certain constraints;
4. the verifier verifies the above proofs without any challenge-response round-trip, just checking
   them against the original circuit.

The set of values produced at step #2 is known as the **witness**. You can think of it as the
"execution trace" of the computation, since it includes all intermediate values. In the PLONK
proving scheme the witness is organized in three columns of equal height:

- the column of the left-hand side inputs of all gates,
- the column of the right-hand side inputs of all gates,
- and the column of the outputs of all gates.

The i-th row of each column contains the corresponding value for the i-th gate.

For example, the [circuit above](#circuits) would have the following witness when the secret input
$x$ is set to 3:

| LHS | RHS | Out |
| --- | --- | --- |
| 3   | 3   | 9   |
| 9   | 3   | 27  |
| 3   | 27  | 30  |
| 30  | 5   | 35  |

Proving knowledge of the witness (as per point 3a above) is easy:

- each column of the witness is padded with zeros until its size is a power of 2,
- each column is then encoded as a polynomial using the FFT algorithm,
- the polynomial is committed to G1 as per KZG and the 3 commitments are provided as proof,
- KZG openings are provided to reveal the public parts of the computation.

However, this doesn't prove that the witnessed values really did result from computing the known
circuit. To achieve that, we need to enforce a set of polynomial equations defined by the circuit.
These equations are known as **constraints**. The initial definition of a circuit, which is
performed only once and ahead of time, results in two types of constraints:
[**gates constraints**](#gate-constraints) and [**wire constraints**](#wire-constraints), discussed
below. This initial circuit definition process can be performed independently by the prover and the
verifier, but it must results in exactly the same constraints for the proofs to be valid.

## Gate Constraints

In the PLONK proving scheme, each gate defines a polynomial constraint of the following form:

$$
q_L \cdot w_L + q_R \cdot w_R + q_O \cdot w_O + q_M \cdot w_L \cdot w_R + q_C = 0
$$

where:

- $w_L$ is the left-hand side input of the gate,
- $w_R$ is the right-hand side input of the gate,
- $w_O$ is the output of the gate,
- the $q_*$ factors are constants specific to the gate.

For example, an addition gate would have:

$$
q_L = 1, q_R = 1, q_O = -1, q_M = 0, q_C = 0
$$

whereas a multiplication gate would have:

$$
q_L = 0, q_R = 0, q_O = -1, q_M = 1, q_C = 0
$$

> [!NOTE]
> Negative values don't exist in our scalar field. What we actually do to achieve the same result is
> to set $q_O = r - 1$, to which -1 is congruent. $r$ is the prime order of the BLS12-381 scalar
> field, provided [above](#evaluation-domain-and-polynomial-interpolation).

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
