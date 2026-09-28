package com.namaste.hindi

import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.Display
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.util.Locale

class MainActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var webView: WebView
    private var textToSpeech: TextToSpeech? = null
    private var isTtsReady: Boolean = false

    companion object {
        private const val TAG = "NamasteHindi"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        optimizeForHighRefreshRate()

        try {
            textToSpeech = TextToSpeech(this, this)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize TTS", e)
        }

        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#1a365d"))
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            setBackgroundColor(Color.parseColor("#1a365d"))
        }
        rootLayout.addView(webView)
        setContentView(rootLayout)

        configureWebView()

        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { _, insets ->
            val statusBarsAndCutout = insets.getInsets(
                WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val navBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            rootLayout.setPadding(0, statusBarsAndCutout.top, 0, navBars.bottom)
            insets
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private fun optimizeForHighRefreshRate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val display = display ?: return
                val modes = display.supportedModes ?: return
                var bestMode: Display.Mode? = null
                var maxRate = 60.0f
                for (mode in modes) {
                    if (mode.refreshRate > maxRate) {
                        maxRate = mode.refreshRate
                        bestMode = mode
                    }
                }
                bestMode?.let {
                    val params = window.attributes
                    params.preferredDisplayModeId = it.modeId
                    window.attributes = params
                    Log.i(TAG, "Galaxy S24 Ultra / High refresh rate mode activated: ${it.refreshRate} Hz (Mode ID: ${it.modeId})")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not set high refresh rate mode: ${e.message}")
            }
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val locale = Locale("hi", "IN")
            val res = textToSpeech?.setLanguage(locale)
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                textToSpeech?.setLanguage(Locale("hi"))
            }
            textToSpeech?.setSpeechRate(0.85f)
            textToSpeech?.setPitch(1.0f)
            isTtsReady = true
            Log.i(TAG, "Native Hindi TextToSpeech successfully initialized.")
        } else {
            Log.w(TAG, "Native TextToSpeech initialization failed with status $status")
        }
    }

    override fun onDestroy() {
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        webView.destroy()
        super.onDestroy()
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun speakHindi(text: String?) {
            if (text.isNullOrBlank()) return
            runOnUiThread {
                if (isTtsReady && textToSpeech != null) {
                    textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "TTS_${System.currentTimeMillis()}")
                }
            }
        }

        @JavascriptInterface
        fun vibrate(type: String?) {
            runOnUiThread {
                try {
                    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                        manager?.defaultVibrator
                    } else {
                        @Suppress("DEPRECATION")
                        getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    } ?: return@runOnUiThread

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val effect = when (type) {
                            "success" -> VibrationEffect.createOneShot(45L, 200)
                            "tick" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                            "error" -> VibrationEffect.createWaveform(longArrayOf(0, 40, 50, 40), intArrayOf(0, 180, 0, 180), -1)
                            "click" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                            else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                        }
                        vibrator.vibrate(effect)
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(25L)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Haptic vibration error", e)
                }
            }
        }

        @JavascriptInterface
        fun isSPenSupported(): Boolean {
            val hasFeature = packageManager.hasSystemFeature("com.sec.feature.spen_usp")
            val isSamsung = Build.MANUFACTURER.equals("samsung", ignoreCase = true)
            return hasFeature || isSamsung
        }

        @JavascriptInterface
        fun isGalaxyS24Ultra(): Boolean {
            val model = Build.MODEL.uppercase(Locale.ROOT)
            val isSamsung = Build.MANUFACTURER.equals("samsung", ignoreCase = true)
            return isSamsung && (model.contains("S928") || model.contains("GALAXY S24 ULTRA"))
        }

        @JavascriptInterface
        fun getDeviceModel(): String {
            return "${Build.MANUFACTURER} ${Build.MODEL}"
        }

        @JavascriptInterface
        fun getAndroidVersion(): Int {
            return Build.VERSION.SDK_INT
        }
    }
}
