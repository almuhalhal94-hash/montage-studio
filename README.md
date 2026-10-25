# montage-studio
مستودع المونتاج والموشن قرافيكس للأستاذ طلال المهلهل — يجمع سكيلات المونتاج في مكان واحد لاستخدامها في Claude Code.

## الهيكل

| المجلد | المحتوى |
|---|---|
| `skills/majed-video/` | حزمة «مونتاج ماجد»: montage-video، video-ad-editor، podcast-video، motion-video، thumbnail-video (+ tools) |
| `skills/motion/` | موشن قرافيكس: motion-design، motion-effects، motion-explainer، motion-prompt-writer، motion-brief-writer، promptmotion-library، loop-cover، animated-chart، milestone-reveal، apple-launch-film، model-showdown |
| `skills/video/` | إنتاج الفيديو: openmontage، promo-video-maker، reel-export، video-shotcraft، video-talkcraft، launch-video، muapi-director، one-file-studio، motion-reel |
| `skills/talal/` | سكيلات أ. طلال: talal-food-ad، talal-lesson-videos، talal-live-stage |
| `app/` | **استوديو المونتاج** — موقع مونتاج كامل (التفاصيل في `app/README.md`) |

## قواعد العمل (تفضيلات أ. طلال)
- لا موسيقى في الفيديوهات؛ الخلفية الصوتية إسلامية هادئة (نشيد بدون آلات أو أذكار).
- ممنوع أي إيقاع أو ضرب (بما فيه الدف) في الخلفية الصوتية.
- في الفيديوهات الحوارية: الخلفية لا تغطي على كلام الشخصيات.
- قصص الصحابة المصوّرة: بدون إظهار الوجوه.
- موشن قرافيكس حقيقي عبر مونتاج ماجد، وليس عرض صور بسيط.
- أدوات مجانية فقط.

## استوديو المونتاج (`app/`)
- ✅ رفع الصور والفيديو والصوت، ترتيب وقص على خط زمني باللمس.
- ✅ نصوص وكابشن عربي متحرك (وكابشن تلقائي بتوقيت الكلمة عبر Whisper على الخادم المحلي).
- ✅ 14 انتقالاً، حركة كين برنز، فلاتر، قوالب جاهزة.
- ✅ تعليق صوتي + خلفية إسلامية هادئة مع خفض تلقائي وقت الكلام.
- ✅ معاينة حيّة ثم تصدير MP4 بمقاسات 9:16 و16:9 و1:1 و4:5.

## ملاحظة
حزمة `majed-video` مأخوذة بدون ملفات العرض (`_pkg`) وبدون نسخ `.skill` المضغوطة لتخفيف الحجم؛ الأصل محفوظ في السكيلات نفسها.
