from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("s3cret-pw")
    assert hashed != "s3cret-pw"  # never stored in plain text
    assert verify_password("s3cret-pw", hashed)
    assert not verify_password("wrong-pw", hashed)


def test_jwt_roundtrip():
    token = create_access_token(subject="42")
    assert decode_token(token) == "42"


def test_invalid_token_returns_none():
    assert decode_token("not.a.valid.token") is None
