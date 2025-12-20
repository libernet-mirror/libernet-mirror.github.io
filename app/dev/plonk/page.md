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

This page describes the full PLONK protocol in detail, but it assumes knowledge of KZG.

## Circuits and Witnesses

TODO

## Evaluation Domain

TODO

## Gate Constraints

TODO

## Wire Constraints

TODO

## Putting It All Together

TODO

[kzg]: https://dankradfeist.de/ethereum/2020/06/16/kate-polynomial-commitments.html
[plonk]: https://eprint.iacr.org/2019/953.pdf
[zksnarks]: https://en.wikipedia.org/wiki/Non-interactive_zero-knowledge_proof
