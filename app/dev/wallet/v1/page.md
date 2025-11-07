---
title: Wallet Format V1
---

## Overview

This page specifies the file format used to store Libernet wallets and the process to derive the
actual accounts of a wallet.

## Anatomy of an Account

An account is a [BLS12-381][bls12-381] key pair that can be used to sign Libernet transactions. On
the public ledger, accounts are known by their _address_, which is computed using the SHA3 hash of
the public BLS key (see the following sections for the exact procedure).

Example account:

- private BLS key scalar (32 bytes): `0x2dde5ffbbc881910a9b1cc9567eae3c1e3f8563f4e2771eb9957ead7b7d6a3c5`
- public BLS key point in compressed form (48 bytes): `0xaa4130eebea382e2c4312186290585d620b858c41a4316d8b62beacb0a443690d7d751ddd7b12eaa58470d29a0bf468b`
- account address (a BLS scalar computed from the SHA3 hash of the public key): `0x210b0a3a23416f66a210531ec98db0fc39162b288f48de9289a6186af4f3eba1`

> [!WARNING]
> Do not use the account above, it's leaked. Any assets transferred to this account will be
> **permanently lost**.

The public ledger associates LIB balances and other assets to account addresses, and the protocol
grants ownership of such assets to the key pair whose public key hashes to the corresponding
address.

## Wallet Features

A single wallet file can derive an unlimited number of accounts. These accounts are completely
independent of each other, meaning it's infeasible for any external actors to determine whether any
two given accounts were generated from the same wallet.

Wallets have a seed and one or more associated passwords (up to 10). The algorithm to derive an
actual account key pair uses the seed and one of the passwords. As a result, different passwords
will generate completely different accounts, and this is the basis for Libernet's plausible
deniability scheme.

The seed of a wallet is stored in cleartext in the wallet file, while the passwords are never stored
directly. Instead, we use the [KZG polynomial commitment scheme][kzg] to commit to them and check
password correctness when a user wants to unlock a wallet.

## Wallet Format

A version 1 Libernet wallet file is a [JSON][json] file with the following fields:

- `version` must be the string `1.0`.
- `seed` is a 64-byte random number stored as a string in lower-case hex format prefixed with `0x`,
  e.g. `0x4bbda518f23220af8eb7e8324cf132c0733b9c876c8e3112c69a27b779d22bf8bb7d089e1ef1706772abd511fc5b45f654e9fcb31fe30875bd6ff0648585cf92`.
- `c` is a BLS point over G1 in compressed format (48 bytes), stored as a string in lower-case hex
  format prefixed with `0x`.
- `y` is an array containing exactly 10 BLS points over G1, each having the same format as `c`.

Example wallet:

> [!WARNING]
> Do not use the following wallet, it's leaked.

```json
{
  "version": "1.0",
  "seed": "0x4bbda518f23220af8eb7e8324cf132c0733b9c876c8e3112c69a27b779d22bf8bb7d089e1ef1706772abd511fc5b45f654e9fcb31fe30875bd6ff0648585cf92",
  "c": "0x801779b8613e11f65317ccdb11c950461b9c305276e06d65316d66322b23d85088a0e9b68381a4531d970062345825e7",
  "y": [
    "0xb466b114add86cef49255e1479436eb4fe49798dbb7573bbf073cb8b9ceee5bf09d3e2465fec4fb9d7819bff62288373",
    "0x8de02594854b5ce06126cdfb0984be3d0b9bc162236c1221f951c358f160d1063397a2e9496366eb4d5c876946234a40",
    "0x900b96dbccd6309840fa075ce54d61a25c212076c329cbdc425e3dbe74380ced054960d144560903112b3ed53ff96d03",
    "0xa4fbeb582ce042e4e9f37db0eca05a1b47293873dc12fd2901dd4822f9017ecf57bf6169af8121daf67755661c18393e",
    "0x83332293c2508f407a4c56792e4e6f06f209bb7751ce0f738c379548fbf9e1f76adfd6f11fc40885a0538f6893683a36",
    "0x881cded5f5efcf4c1618b727bdcc6ecf509a658b7e422b556feab0df4948012a7e65cd89f25bf62f81529136baee0630",
    "0x858c616dad16af911b8afad048de067c5f8e092f82d895f2b0a0f8f0a211a84ff39ce5545d2b7e01becea48fc96b425e",
    "0xb30942bb2f1a7bfc90bbbd9a0b23fe1b08478ad38fab2ed7bcd75c6785f3d2f6d6e6e5e59cececacece4376922ad30a8",
    "0x87abdc824b25ec12162b3062217e5216c624d15a050ccd4d6cc2ad3f9b13f7c9dbda05f9114e49b922bad788e2e5c825",
    "0x85d650e5a5c1ea3ebf4d575f143251158600c4c3bfd2e0fbbc883dd7d1d40f5ca9ddbb91efc3eed5825e62814150a1a8"
  ]
}
```

## Derivation Algorithm

### General Notes

In the following algorithm we perform modular reduction from 512-bit integers to BLS scalars every
time we need to switch to algebraic cryptography, e.g. when converting a SHA3 hash to a scalar. The
reason why we use 512-bit cryptography despite 256 bits being generally considered safe is to
warrant a uniform distribution of the resulting scalar.

The order of the BLS12-381 scalar field is the following ~255-bit prime number:

```
r = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
```

Note that the first few nibbles are `73ed...`, so this value is roughly 0.45 times the full 256-bit
range. Performing modular reduction from the 256-bit range to the $r$ range would result in a
visible skew of the distribution, as ~10% of the values would become 50% more frequent.

On the other hand, the 512-bit range is astronomically larger than $r$ (more than $2^{256}$ times
larger), so in this case the distribution bias resulting from modular reduction is virtually
non-existent.

None of the 512-bit values we use in this type of conversion have endianness, so we always assume
**little endian order**.

### Setup Phase

1. Generate the 64-byte seed using a CSPRNG. Let `s` be this seed.

2. Let the user enter at least one and at most 10 different passwords. Error out if two or more
   passwords are identical.

3. Derive a 64-byte key for each password using the [Argon2id][argon2] key derivation function with
   the following parameters:
   - algorithm version: 19 (0x13)
   - M cost: 1024
   - T cost: 2
   - P cost: 1
   - salt: the seed `s`
   - output length: 64 bytes

   The passwords must be encoded in UTF-8.

4. If the user provided less than 10 passwords, add more randomly generated 64-byte keys until there
   are 10 keys in total. All random keys must be generated by a CSPRNG.

5. Convert the 10 keys to corresponding BLS scalars via modular reduction. Let $z_i$ be the _i_-th
   scalar.

6. Compute a polynomial whose roots are the 10 scalars $z_0$, $z_1$, etc. Let $P$ be this
   polynomial. $P$ can be computed as:

   $$
   \alpha \cdot (x - z_0) \cdot (x - z_1) \cdot ... \cdot (x - z_9)
   $$

   where $\alpha$ is a random BLS scalar.

7. Let `c` be the KZG commitment of $P$ over G1 and `y` the list of KZG proofs of the 10 root points
   $(z_i, 0)$.

8. Shuffle the `y` list (you can use the [Fisher-Yates shuffle][fisher-yates-shuffle] with a
   CSPRNG).

9. Store `s`, `c`, and `y` to the wallet file.

> [!NOTE]
> Step #8 is **very important** to maintain plausible deniability. Don't store the proofs for the
> actual passwords first and those for the random keys last, for example. The order of the proofs
> **must** be randomized securely.

### Unlock Phase

1. Let the user enter a password, encode it in UTF-8, and derive the corresponding Argon2id key
   using the parameters above.

2. Convert the 64-byte Argon2id key to a BLS scalar via modular reduction. Let $z$ be this scalar.

3. For each KZG proof in the `y` array:
   - if the proof successfully verifies that $z$ is a root of the polynomial commited to by `c`,
     then the password is correct;
   - if none of the proofs work, show an invalid password error message and exit.

4. To compute the private BLS key of the _i_-th account:
   - Let `H` be the SHA3-512 hash of a 104-byte message built as follows:
     - the first 64 bytes are the seed `s`,
     - the next 32 bytes are the key scalar $z$ in little endian order,
     - the final 8 bytes are the index `i` in little endian order.
   - Convert `H` to a BLS scalar via modular reduction. The scalar is the private key.

5. The public BLS key is computed over G1 as usual (ECC multiplication by the G1 generator point).

6. The account address is obtained by computing the SHA3-512 hash of the public key point in
   compressed form (48 bytes) and converting the hash to a BLS scalar via modular reduction.

> [!NOTE]
> To prevent timing attacks the algorithm at point #3 must run in constant time, therefore
> implementors must check $z$ against **all** 10 proofs even if one succeeds before checking the
> last.

### Test Vectors

TODO

## Best Practices

Since the account key pairs are derived from both the seed and the password, changing password after
the setup phase is not possible in this version of the Libernet wallet (a different password would
decode different accounts). The passwords are effectively part of the secret that allows recovering
the account keys, and must be treated as such. Implementors should never store these passwords
anywhere and should clearly indicate to the user that they cannot be recovered.

It is possible to add new passwords by running a new [setup phase](#setup-phase) with the existing
seed. The new passwords will decode new accounts while the existing passwords will keep decoding the
existing accounts.

Since we hard-coded a limit of 10 passwords per wallet, implementations **must never** allow more,
as doing so would invalidate plausible deniability by revealing that the user is using more than 10
passwords.

Never allow two or more identical passwords in the setup phase, as those would yield identical
proofs in the `y` array and degrade plausible deniability by leaking information. For example, if
three elements of `y` are identical it means the user repeated the same password 3 times and is
using no more than 7 other passwords.

Since the user is expected to remember all passwords, backing up the seed alone is sufficient to
back up the entire wallet. When restoring a backup, implementors can run the setup phase asking the
user to provide all passwords. If one or more passwords can't be provided right away, a new setup
phase can always be run later.

Even though the seed alone is insufficient to recover any account keys it's unadvisable to store it
in cleartext when backing it up. The Argon2 key derivation function we use will resist dictionary
and brute force attacks even if carried out by highly parallel actors equipped with GPU clusters,
but a targeted attack may use a relatively small dictionary and become successful (in layman's
terms, someone who knows you well enough might just guess your password right).

[argon2]: https://en.wikipedia.org/wiki/Argon2
[bls12-381]: https://hackmd.io/@benjaminion/bls12-381
[fisher-yates-shuffle]: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
[json]: https://www.json.org/
[kzg]: https://dankradfeist.de/ethereum/2020/06/16/kate-polynomial-commitments.html
