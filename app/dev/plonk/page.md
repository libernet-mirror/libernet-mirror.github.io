---
title: zkSNARKs and PLONK
---

## Overview

[zkSNARKs][zksnarks] are powerful modern cryptography primitives used to prove the correct execution
of an arbitrary computation without the need for a verifier to re-execute that computation. In
addition to that, zkSNARKs have the ability to reveal only some parts of the computation and retain
the rest as a secret, all while proving correctness of 100% of it.

Common use cases for zkSNARKs in modern blockchains are:

- proving the correct execution of a smartcontract endpoint without requiring all validators in the
  network to re-execute the corresponding transaction,
- implementing privacy-preserving protocols such as anonymous voting and payments.

The acronym "zkSNARK" stands for **Z**ero-**K**nowledge **S**uccinct **N**on-interactive
**Ar**gument of **K**nowledge:

- **zero-knowledge** means the proven computation is not revealed, except for the parts the prover
  chooses to reveal;
- **succinct** means the size of the proof is sublinear in the size of the original computation (in
  fact, the zkSNARK scheme used in Libernet results in constant-size proofs of about 1 KiB each);
- **non-interactive** means the verification protocol does not require a challenge-response
  round-trip;
- **argument of knowledge** indicates that the prover really had the full trace of the computation,
  notwithstanding the above requirements.

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
points represented by the above pairs. This is achieved by **polynomial interpolation**, and the
resulting polynomial would evaluate to `33` in `0`, to `10` in `1`, etc., effectively encoding the
original list at the coordinates 0, 1, 2, and 3.

There are two distinct approaches to implementing polynomial interpolation:
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

When working with standard math tools the $\omega^N = 1$ equation has exactly $N$ complex solutions.
For example, for $N = 4$ the four solutions are $i$, $-i$, $1$, and $-1$ (with $i$ being the
[imaginary unit][imaginary-unit] $\sqrt{-1}$).

In modular arithmetic things work differently, but since the BL12-381 scalar field has prime order,
[Fermat's Little Theorem][fermat] shows us that the $\omega^N = 1$ equation can still be satisfied.
In fact, the field has the following well-known $2^{32}$-th root of unity:

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
2. the prover runs the computation, providing input values to the circuit, computing all
   intermediate values, and obtaining the output values;
3. the prover provides:
   - a proof of knowledge of the above values;
   - a proof that the above values satisfy certain constraints;
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

- the columns of the witness are padded with zeros until their size is a power of 2,
- each column is then encoded as a polynomial using the FFT algorithm,
- the polynomial is committed to G1 as per KZG and the 3 commitments are provided as proof,
- KZG openings are provided to reveal the public parts of the computation.

However, this doesn't prove that the witnessed values really did result from computing the known
circuit. To achieve that we need to enforce a set of polynomial equations that characterize the
circuit. These equations are known as **constraints**. The initial definition of a circuit, which is
performed only once and ahead of time, results in two types of constraints:
[**gates constraints**](#gate-constraints) and [**wire constraints**](#wire-constraints), discussed
below. This initial definition process can be performed independently by the prover and the
verifier, but it must results in exactly the same constraints for the proofs to be valid.

## Gate Constraints

In the PLONK proving scheme each gate defines a polynomial constraint of the following form:

$$
q_L \cdot l + q_R \cdot r + q_O \cdot o + q_M \cdot l \cdot r + q_C = 0
$$

where:

- $l$ is the left-hand side input of the gate,
- $r$ is the right-hand side input of the gate,
- $o$ is the output of the gate,
- the $q_*$ factors are constants specific to the gate.

For example, an addition gate would have:

$$
q_L = 1, q_R = 1, q_O = -1, q_M = 0, q_C = 0
$$

effectively yielding the constraint:

$$
l + r - o = 0 \\
l + r = o
$$

A multiplication gate would instead have:

$$
q_L = 0, q_R = 0, q_O = -1, q_M = 1, q_C = 0
$$

resulting in:

$$
-o + l \cdot r = 0 \\
l \cdot r = o
$$

> [!NOTE]
> Negative values don't exist in our scalar field. What we actually do for the above gate types to
> achieve the same result is to set $q_O = r - 1$, to which -1 is congruent. $r$ is the prime order
> of the BLS12-381 scalar field, provided [above](#evaluation-domain-and-polynomial-interpolation).

Defining a circuit with $N$ gates would result in $N$ values for $q_L$, $N$ values for $q_R$, and so
on, meaning we can encode the five $q_*$ columns in five corresponding polynomials $Q_*$. Let $L$,
$R$, and $O$ be the polynomials encoding the three witness columns. After interpolating all
polynomials we have:

$$
T(x) = Q_L(x) \cdot L(x) + Q_R(x) \cdot R(x) + Q_O(x) \cdot O(x) + Q_M(x) \cdot L(x) \cdot R(x) + Q_C(x)
$$

Note that the $Q_*$ can (and in fact _must_) be interpolated ahead of time, so they only contribute
to the cost of the setup phase (in both the prover and the verifier) but not to the proving or
verification cost.

This equation is a single polynomial equation that we can commit to and for which we can provide KZG
openings on one or more challenge points. To maintain the protocol non-interactive we can use the
[Fiat-Shamir heuristic][fiat-shamir] to determine the challenge points, e.g. we can compute them by
hashing the polynomial commitments of the witness columns.

To prove that the witness $(L, R, O)$ really was computed by the circuit gates defined by $Q_*$ we
need to prove:

$$
T(\omega_0^i) = 0
$$

for all $i$, meaning that our constraint equation must be zero on all points of the evaluation
domain $\omega_0^0$, $\omega_0^1$, $\omega_0^2$, ..., $\omega_0^{k - 1}$. In other words, **all
powers of $\omega_0$ must be roots of the polynomial $T(x)$**. That means $T$ can be rewritten as:

$$
\begin{aligned}
T(x) &= P(x) \cdot (x - \omega_0^0) \cdot (x - \omega_0^1) \cdot ... \cdot (x - \omega_0^{k - 1}) \\
     &= P(x) \cdot \prod_{i = 0}^{k - 1} (x - \omega_0^i)
\end{aligned}
$$

where $P$ is a quotient polynomial resulting from the division of $T$ by
$\prod_{i = 0}^{k - 1} (x - \omega_0^i)$.

The divisor $\prod_{i = 0}^{k - 1} (x - \omega_0^i)$ is a polynomial that vanishes on all the
evaluation domain and doesn't have any other roots. It's sometimes known as the **zero polynomial**,
and we'll indicate it with $Z(x)$.

Determining the coefficients of $Z$ is very straightforward because the condition of vanishing on
all $k$-th roots of unity is simply defined by the equation:

$$
x^k = 1 \\
x^k - 1 = 0
$$

so we have:

$$
Z(x) = x^k - 1
$$

Circling back to the problem of proving that $T(x)$ is satisfied, i.e. zero on all powers of
$\omega_0$, we can adopt the following protocol:

- the prover determines a challenge value $\beta$ using the Fiat-Shamir heuristic;
- the prover generates the coefficients of $T$ by multiplying the $Q_*$ polynomials by the witness
  polynomials as per the definition of $T$;
- the prover divides $T$ by $Z$ using [polynomial long division][long-division] and obtains $P$ (if
  $T$ really is satisfied there must be no remainder);
- the prover commits to $P$ and opens it at $\beta$.

Note that **the existence of $P$ without any remainder implies that $T$ is divisible by $Z$ and is
therefore zero on all the domain and fully satisfied**. Thanks to that, on the verifier side we just
need to verify the KZG opening for $L(\beta)$, $R(\beta)$, $O(\beta)$, and $P(\beta)$ and check:

$$
Q_L(\beta) \cdot L(\beta) + Q_R(\beta) \cdot R(\beta) + Q_O(\beta) \cdot O(\beta) + Q_M(\beta) \cdot L(\beta) \cdot R(\beta) + Q_C(\beta) = P(\beta) \cdot Z(\beta)
$$

This is however not yet enough to prove that the witness really fits the circuit: our protocol so
far checks that each gate has worked correctly but doesn't check that the gates were connected as
intended. To achieve the latter we need to check [wire constraints](#wire-constraints).

## Wire Constraints

This is the most complex part of PLONK.

Proving that the gates of the circuit are connected as intended boils down to proving that specific
groups of cells of the witness table have equal values, and doing so without revealing the whole
witness.

Here is once again the full witness table of our [sample circuit](#circuits):

| LHS | RHS | Out |
| --- | --- | --- |
| 3   | 3   | 9   |
| 9   | 3   | 27  |
| 3   | 27  | 30  |
| 30  | 5   | 35  |

Based on the wiring of the circuit, we need to partition the wires as follows and prove that each
partition has identical values. We use $L_i$, $R_i$, and $O_i$ to indicate the $i$-th row of the
left-hand side, right-hand side, and output column, respectively.

- $\{ L_0, R_0, R_1, L_2 \}$ (value 3)
- $\{ O_0, L_1 \}$ (value 9)
- $\{ O_1, R_2 \}$ (value 27)
- $\{ O_2, L_3 \}$ (value 30)

To achieve our goal we'll now introduce a new polynomial expression known as **coordinate pair
accumulator**. Let $\beta$ and $\gamma$ be two challenge values computed with Fiat-Shamir (one of
the two can be the same used to prove the [gate constraints](#gate-constraints)). The coordinate
pair accumulator is:

TODO

## Putting It All Together

TODO

[crypto-poly]: https://github.com/libernet-mirror/crypto/blob/main/src/poly.rs
[fermat]: https://en.wikipedia.org/wiki/Fermat%27s_little_theorem
[fiat-shamir]: https://en.wikipedia.org/wiki/Fiat%E2%80%93Shamir_heuristic
[fft]: https://en.wikipedia.org/wiki/Fast_Fourier_transform
[imaginary-unit]: https://en.wikipedia.org/wiki/Imaginary_unit
[kzg]: https://dankradfeist.de/ethereum/2020/06/16/kate-polynomial-commitments.html
[lagrange]: https://en.wikipedia.org/wiki/Lagrange_polynomial
[long-division]: https://en.wikipedia.org/wiki/Polynomial_long_division
[plonk]: https://eprint.iacr.org/2019/953.pdf
[zksnarks]: https://en.wikipedia.org/wiki/Non-interactive_zero-knowledge_proof
