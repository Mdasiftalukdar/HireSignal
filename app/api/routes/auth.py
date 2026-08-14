"""Authentication: email/password (with OTP verification) and Google OAuth."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.oauth import oauth
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    EmailIn,
    OtpVerify,
    PasswordReset,
    RegisterResponse,
    Token,
    UserCreate,
    UserRead,
)
from app.services.email import send_otp_email, send_password_reset_email
from app.services.otp import create_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])


async def _get_by_email(db: AsyncSession, email: str) -> User | None:
    return (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()


# ---------- Email / password (+ OTP verification) ----------


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    if await _get_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        email_verified=False,
        auth_provider="email",
    )
    db.add(user)
    await db.commit()
    code = await create_otp(payload.email)
    await send_otp_email(payload.email, code)
    return RegisterResponse(message="Verification code sent to your email.", email=payload.email)


@router.post("/verify-otp", response_model=Token)
async def verify_email_otp(payload: OtpVerify, db: AsyncSession = Depends(get_db)):
    user = await _get_by_email(db, payload.email)
    if user is None:
        raise HTTPException(status_code=404, detail="No account for that email")
    if not await verify_otp(payload.email, payload.code):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    user.email_verified = True
    await db.commit()
    return Token(access_token=create_access_token(subject=str(user.id)))


@router.post("/resend-otp", response_model=RegisterResponse)
async def resend_otp(payload: EmailIn, db: AsyncSession = Depends(get_db)):
    user = await _get_by_email(db, payload.email)
    if user is not None and not user.email_verified:
        code = await create_otp(payload.email)
        await send_otp_email(payload.email, code)
    # Same response regardless, so we don't reveal which emails exist.
    return RegisterResponse(
        message="If that email needs verification, a new code was sent.", email=payload.email
    )


# ---------- Forgot / reset password ----------


@router.post("/forgot-password", response_model=RegisterResponse)
async def forgot_password(payload: EmailIn, db: AsyncSession = Depends(get_db)):
    user = await _get_by_email(db, payload.email)
    # Only accounts that actually use password login can reset one. Google-only
    # accounts (no hashed_password) should sign in with Google instead.
    if user is not None and user.hashed_password:
        code = await create_otp(payload.email, purpose="reset")
        await send_password_reset_email(payload.email, code)
    # Same response regardless, so we don't reveal which emails have accounts.
    return RegisterResponse(
        message="If an account exists for that email, a reset code was sent.",
        email=payload.email,
    )


@router.post("/reset-password", response_model=Token)
async def reset_password(payload: PasswordReset, db: AsyncSession = Depends(get_db)):
    user = await _get_by_email(db, payload.email)
    # Verifying the code proves control of the inbox; a wrong/expired/missing code
    # (or a non-password account) all fail with the same generic message.
    if (
        user is None
        or not user.hashed_password
        or not await verify_otp(payload.email, payload.code, purpose="reset")
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    user.hashed_password = hash_password(payload.new_password)
    user.email_verified = True  # they just proved they control the inbox
    await db.commit()
    return Token(access_token=create_access_token(subject=str(user.id)))


@router.post("/login", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    user = await _get_by_email(db, form.username)
    if (
        user is None
        or not user.hashed_password
        or not verify_password(form.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify the code sent to your email.",
        )
    return Token(access_token=create_access_token(subject=str(user.id)))


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


# ---------- Google OAuth (Authorization Code flow) ----------


@router.get("/google/login")
async def google_login(request: Request):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google login is not configured.")
    return await oauth.google.authorize_redirect(request, settings.google_redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400, detail=f"Google authentication failed: {exc.__class__.__name__}"
        ) from exc

    info = token.get("userinfo") or {}
    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email address.")

    user = await _get_by_email(db, email)
    if user is None:
        user = User(
            email=email,
            hashed_password=None,
            full_name=info.get("name"),
            email_verified=True,
            auth_provider="google",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.email_verified:
        user.email_verified = True  # Google verified the address
        await db.commit()

    # Hand the JWT to the SPA: redirect to the frontend callback route with the token
    # in the URL fragment (#), so it never hits server logs or the Referer header.
    jwt = create_access_token(subject=str(user.id))
    return RedirectResponse(url=f"{settings.frontend_url}/auth/callback#token={jwt}")
