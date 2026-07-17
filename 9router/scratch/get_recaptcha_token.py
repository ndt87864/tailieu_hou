import asyncio
import sys
import os
import json
import time

sys.path.append("D:/arena_ai")
CACHE_FILE = "c:/Users/admin/tailieu_hou/9router/scratch/recaptcha_cache.json"

async def main():
    # 1. Cache disabled to prevent token reuse error (reCAPTCHA v3 tokens are single-use)
    pass

    # 2. Fetch fresh token
    # Ensure working directory is set to D:/arena_ai inside python before importing/calling recaptcha
    os.chdir("D:/arena_ai")
    
    import src.config as config_module
    orig_get_config = config_module.get_config
    def patched_get_config():
        cfg = orig_get_config()
        cfg["recaptcha_sitekey"] = "6LeTGMcsAAAAALuIlkVwIxaAuZA8VledA6d3Nnb0"
        cfg["recaptcha_action"] = "chat_submit"
        cfg["auth_token"] = "valid_token_placeholder"
        cfg["auth_tokens"] = ["valid_token_placeholder"]
        return cfg
    config_module.get_config = patched_get_config

    import src.main as main_module
    orig_get_config_main = main_module.get_config
    def patched_get_config_main():
        cfg = orig_get_config_main()
        cfg["recaptcha_sitekey"] = "6LeTGMcsAAAAALuIlkVwIxaAuZA8VledA6d3Nnb0"
        cfg["recaptcha_action"] = "chat_submit"
        cfg["auth_token"] = "valid_token_placeholder"
        cfg["auth_tokens"] = ["valid_token_placeholder"]
        return cfg
    main_module.get_config = patched_get_config_main

    import src.browser_utils as browser_utils
    orig_safe_page_evaluate = browser_utils.safe_page_evaluate
    async def patched_safe_page_evaluate(page, script, *args, **kwargs):
        if "recaptcha_sitekey" in kwargs:
            sitekey = kwargs.pop("recaptcha_sitekey")
            script = script.replace("recaptcha_sitekey", f"'{sitekey}'")
        return await orig_safe_page_evaluate(page, script, *args, **kwargs)
    browser_utils.safe_page_evaluate = patched_safe_page_evaluate
    main_module.safe_page_evaluate = patched_safe_page_evaluate

    from src.recaptcha import get_recaptcha_v3_token
    
    try:
        token = await get_recaptcha_v3_token()
        if token:
            # Save to cache
            try:
                with open(CACHE_FILE, "w") as f:
                    json.dump({"token": token, "timestamp": time.time()}, f)
            except Exception:
                pass
                
            print("TOKEN_START")
            print(token)
            print("TOKEN_END")
        else:
            print("ERROR: Failed to retrieve recaptcha token")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
