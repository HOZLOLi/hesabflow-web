
import React, { useState } from 'react';
import { Book, Calculator, ShoppingCart, Hammer, CreditCard, Users, Database, LayoutDashboard, ChevronLeft, Wrench } from 'lucide-react';

interface HelpCenterProps {
  windowId: string;
}

type Section = 'intro' | 'invoices' | 'treasury' | 'inventory' | 'production' | 'customers' | 'calculations' | 'repairs' | 'database' | 'troubleshooting';

export const HelpCenter: React.FC<HelpCenterProps> = () => {
  const [activeSection, setActiveSection] = useState<Section>('intro');

  const menuItems: { id: Section; label: string; icon: any }[] = [
    { id: 'intro', label: 'معرفی و کلیات', icon: LayoutDashboard },
    { id: 'invoices', label: 'صدور فاکتور', icon: ShoppingCart },
    { id: 'repairs', label: 'رسید تعمیرات', icon: Wrench },
    { id: 'treasury', label: 'خزانه‌داری و چک', icon: CreditCard },
    { id: 'inventory', label: 'انبارداری', icon: Database },
    { id: 'production', label: 'کارگاه تولیدی', icon: Hammer },
    { id: 'customers', label: 'مشتریان و حساب‌ها', icon: Users },
    { id: 'calculations', label: 'فرمول‌های محاسباتی', icon: Calculator },
    { id: 'database', label: 'دیتابیس و ذخیره‌سازی', icon: Database },
    { id: 'troubleshooting', label: 'عیب‌یابی و رفع مشکل', icon: Book },
  ];

  return (
    <div className="flex h-full bg-white dark:bg-surface">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-gray-50 dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
            <h3 className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
                <Book size={20} className="text-blue-600" />
                راهنمای سیستم
            </h3>
            <p className="text-xs text-gray-500 mt-1">نسخه ۱.۰.۰</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
            {menuItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${
                        activeSection === item.id 
                        ? 'bg-white dark:bg-surface text-blue-600 dark:text-blue-400 border-r-4 border-blue-600' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 border-r-4 border-transparent'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <item.icon size={18} />
                        {item.label}
                    </div>
                    {activeSection === item.id && <ChevronLeft size={14} />}
                </button>
            ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 text-gray-800 dark:text-gray-200 leading-relaxed">
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            
            {activeSection === 'intro' && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">معرفی حساب فلو (HESAB FLOW)</h2>
                    <p>
                        حساب فلو یک نرم‌افزار حسابداری ابری و مدرن است که با هدف ساده‌سازی فرآیندهای مالی برای کسب‌وکارهای کوچک و متوسط، فروشگاه‌ها و کارگاه‌های تولیدی طراحی شده است.
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-4 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded">
                            <h4 className="font-bold mb-2">ویژگی‌های کلیدی</h4>
                            <ul className="list-disc list-inside text-sm space-y-1 text-gray-600 dark:text-gray-400">
                                <li>رابط کاربری مینیمال و سریع</li>
                                <li>پشتیبانی کامل از عملیات تولید</li>
                                <li>مدیریت هوشمند چک‌های صیادی</li>
                                <li>تحلیلگر هوشمند مبتنی بر هوش مصنوعی</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {activeSection === 'invoices' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">مدیریت فاکتورها</h2>
                    
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-600">انواع فاکتور</h3>
                        <ul className="list-disc list-inside space-y-2 text-sm">
                            <li><strong>فاکتور فروش:</strong> کالا از انبار کسر می‌شود، مبلغ به حساب بدهی مشتری یا صندوق اضافه می‌شود.</li>
                            <li><strong>فاکتور خرید:</strong> کالا به انبار اضافه می‌شود، میانگین قیمت خرید به‌روزرسانی می‌شود.</li>
                            <li><strong>پیش‌فاکتور:</strong> هیچ اثر مالی یا انباری ندارد، صرفاً جهت اطلاع‌رسانی است.</li>
                            <li><strong>ضایعات:</strong> کالا از انبار کسر می‌شود اما درآمدی شناسایی نمی‌شود (زیان).</li>
                        </ul>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 border border-amber-200 dark:border-amber-800 rounded">
                        <h4 className="font-bold text-amber-700 dark:text-amber-500 mb-2">نکته مهم در پرداخت ترکیبی</h4>
                        <p className="text-sm">
                            در پرداخت ترکیبی، شما می‌توانید بخشی از مبلغ را نقد، بخشی را چک و مابقی را به صورت نسیه ثبت کنید. سیستم به طور خودکار مانده را محاسبه کرده و به حساب مشتری منظور می‌کند.
                        </p>
                    </div>
                </div>
            )}

            {activeSection === 'treasury' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">خزانه‌داری و چک</h2>
                    
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg">چرخه حیات چک</h3>
                        <div className="flex items-center gap-4 text-sm font-mono mt-2 overflow-x-auto">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded">ثبت اولیه (در جریان)</span>
                            <span>➜</span>
                            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded">پاس/وصول شده</span>
                            <span>OR</span>
                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded">برگشت خورده</span>
                        </div>
                        <p className="text-sm mt-2 text-gray-600">
                            تا زمانی که وضعیت چک "در جریان" است، هیچ اثری بر موجودی بانک یا صندوق شما ندارد. تنها پس از تغییر وضعیت به "پاس شده"، تراکنش مالی ثبت می‌شود.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg">حساب‌های بانکی</h3>
                        <p className="text-sm">
                            شما می‌توانید بی‌نهایت حساب بانکی یا صندوق تعریف کنید. انتقال وجه بین حساب‌ها از طریق فرم "تراکنش بانکی" با انتخاب نوع "انتقال داخلی" انجام می‌شود.
                        </p>
                    </div>
                </div>
            )}

            {activeSection === 'production' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">کارگاه تولیدی</h2>
                    
                    <div className="p-4 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded">
                        <h3 className="font-bold mb-2">فرمول محاسبه قیمت تمام شده</h3>
                        <code className="block bg-black dark:bg-black text-white p-3 rounded font-mono text-sm dir-ltr">
                            Cost = (Raw Materials) + (External Costs)
                        </code>
                        <p className="text-xs mt-2 text-gray-500">
                            * هزینه‌های داخلی (مثل حقوق خودتان) به عنوان ارزش افزوده در نظر گرفته می‌شوند و در قیمت تمام شده حسابداری لحاظ نمی‌شوند، اما در قیمت پیشنهادی فروش محاسبه می‌گردند.
                        </p>
                    </div>

                    <div className="space-y-2 text-sm">
                        <p><strong>تکمیل آنی:</strong> اگر فرآیند تولید زمان‌بر نیست، از این گزینه استفاده کنید. مواد اولیه بلافاصله کسر و محصول نهایی اضافه می‌شود.</p>
                        <p><strong>پروژه ساخت:</strong> برای فرآیندهای طولانی. مواد اولیه کسر می‌شوند اما محصول نهایی تا زمان تکمیل پروژه به انبار اضافه نمی‌شود.</p>
                    </div>
                </div>
            )}

            {activeSection === 'calculations' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">فرمول‌های محاسباتی</h2>
                    
                    <div className="grid gap-4">
                        <div className="border border-gray-200 dark:border-neutral-800 p-4 rounded">
                            <h4 className="font-bold text-blue-600 mb-1">سود هر فاکتور</h4>
                            <p className="font-mono text-sm bg-gray-100 dark:bg-neutral-900 p-2 rounded">
                                (قیمت فروش - قیمت خرید لحظه‌ای) × تعداد
                            </p>
                            <p className="text-xs text-gray-500 mt-1">قیمت خرید لحظه‌ای، آخرین قیمت خریدی است که برای کالا ثبت شده است.</p>
                        </div>

                        <div className="border border-gray-200 dark:border-neutral-800 p-4 rounded">
                            <h4 className="font-bold text-emerald-600 mb-1">نقدینگی کل</h4>
                            <p className="font-mono text-sm bg-gray-100 dark:bg-neutral-900 p-2 rounded">
                                ∑ موجودی تمام بانک‌ها + ∑ موجودی تمام صندوق‌ها
                            </p>
                        </div>

                        <div className="border border-gray-200 dark:border-neutral-800 p-4 rounded">
                            <h4 className="font-bold text-purple-600 mb-1">مانده حساب مشتری</h4>
                            <p className="font-mono text-sm bg-gray-100 dark:bg-neutral-900 p-2 rounded">
                                (خرید نسیه + چک‌های پاس نشده پرداختی) - (پرداخت‌های نقد + چک‌های پاس شده)
                            </p>
                            <p className="text-xs text-gray-500 mt-1">مثبت = بدهکار (باید پول بدهد) | منفی = بستانکار (باید پول بگیرد)</p>
                        </div>
                    </div>
                </div>
            )}

            {activeSection === 'inventory' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">انبارداری</h2>
                    <p className="text-sm leading-7">
                        سیستم انبارداری به صورت خودکار با صدور فاکتورهای خرید و فروش به‌روز می‌شود.
                        <br/>
                        شما می‌توانید برای هر کالا <strong>"نقطه سفارش" (Min Stock)</strong> تعریف کنید. سیستم به محض رسیدن موجودی به این عدد، اعلان هشدار ارسال می‌کند.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded text-sm border border-blue-100 dark:border-blue-800">
                        <strong>کاردکس کالا:</strong> ریز گردش (ورود و خروج) هر کالا به همراه تاریخ، ساعت و دلیل تغییر در بخش کاردکس قابل مشاهده است.
                    </div>
                </div>
            )}

            {activeSection === 'customers' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">مشتریان و حساب‌ها</h2>
                    <p className="text-sm">
                        این بخش همان دفتر معین مشتریان است. تمام تعاملات مالی با یک شخص (فاکتور، چک، واریز نقد) در اینجا ثبت می‌شود.
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-2 mt-4">
                        <li>قابلیت تعریف حد اعتبار برای مشتری (نمایش هشدار در صورت عبور از سقف بدهی).</li>
                        <li>مشاهده وضعیت چک‌های پاس نشده مشتری در یک نگاه.</li>
                        <li>امکان ثبت "تراز اولیه" برای مشتریانی که از قبل با آن‌ها حساب و کتاب داشته‌اید.</li>
                    </ul>
                </div>
            )}

            {activeSection === 'repairs' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">سیستم رسید تعمیرات</h2>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-200 dark:border-blue-800 rounded">
                        <p className="text-sm">
                            سیستم جامع برای مدیریت دریافت، تعمیر و تحویل دستگاه‌های مشتریان با قابلیت مدیریت قطعات، محاسبات مالی دقیق و پیگیری وضعیت.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-blue-600">چرخه کامل تعمیرات</h3>
                        
                        <div className="space-y-3">
                            <div className="border-r-4 border-blue-500 pr-3">
                                <h4 className="font-bold text-sm">1️⃣ دریافت دستگاه</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    ثبت اطلاعات مشتری، مشخصات دستگاه، شرح مشکل و دریافت بیعانه (اختیاری). بیعانه به صورت خودکار در خزانه‌داری ثبت می‌شود.
                                </p>
                            </div>

                            <div className="border-r-4 border-amber-500 pr-3">
                                <h4 className="font-bold text-sm">2️⃣ فرآیند تعمیر</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    افزودن قطعات مصرفی از انبار (با چک موجودی)، آپلود عکس‌های مراحل تعمیر و ثبت یادداشت‌ها. قطعات بلافاصله از انبار کسر می‌شوند.
                                </p>
                            </div>

                            <div className="border-r-4 border-emerald-500 pr-3">
                                <h4 className="font-bold text-sm">3️⃣ تسویه و تحویل</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    محاسبه خودکار هزینه قطعات، ثبت دستمزد، تعیین قیمت نهایی و نمایش سود خالص. دو روش تحویل: تبدیل به فاکتور یا تحویل معمولی.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-purple-600">محاسبات مالی</h3>
                        <div className="bg-gray-50 dark:bg-neutral-900 p-4 rounded border border-gray-200 dark:border-neutral-800">
                            <div className="space-y-2 text-sm font-mono">
                                <div>هزینه قطعات = مجموع (تعداد × قیمت خرید)</div>
                                <div>جمع هزینه‌ها = هزینه قطعات + دستمزد</div>
                                <div>مانده دریافتی = قیمت نهایی - بیعانه</div>
                                <div className="text-emerald-600 dark:text-emerald-400 font-bold">سود خالص = قیمت نهایی - بیعانه - هزینه قطعات - دستمزد</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-amber-600">وضعیت‌های رسید</h3>
                        <div className="flex items-center gap-3 text-sm font-mono mt-2 overflow-x-auto">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded whitespace-nowrap">🔵 در حال تعمیر</span>
                            <span>➜</span>
                            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded whitespace-nowrap">🟢 تعمیر شده</span>
                            <span>➜</span>
                            <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded whitespace-nowrap">⚪ تحویل داده شده</span>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 border border-amber-200 dark:border-amber-800 rounded">
                        <h4 className="font-bold text-amber-700 dark:text-amber-500 mb-2">نکات مهم</h4>
                        <ul className="text-sm space-y-1 list-disc list-inside">
                            <li>قطعات نمی‌توانند بیش از موجودی انبار اضافه شوند</li>
                            <li>هشدار سود منفی نمایش داده می‌شود</li>
                            <li>الگوهای قیمت‌گذاری برای سرعت بیشتر</li>
                            <li>3 دسته عکس: دریافت، تعمیر، تحویل (همه اختیاری)</li>
                            <li>لینک به مشتری اختیاری است</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-gray-700 dark:text-gray-300">میانبرهای کیبورد</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-gray-100 dark:bg-neutral-900 p-2 rounded">
                                <kbd className="bg-white dark:bg-black px-2 py-1 rounded text-xs">ESC</kbd> بستن پنجره
                            </div>
                            <div className="bg-gray-100 dark:bg-neutral-900 p-2 rounded">
                                <kbd className="bg-white dark:bg-black px-2 py-1 rounded text-xs">↓</kbd> فیلد بعدی
                            </div>
                            <div className="bg-gray-100 dark:bg-neutral-900 p-2 rounded">
                                <kbd className="bg-white dark:bg-black px-2 py-1 rounded text-xs">Ctrl+S</kbd> ذخیره
                            </div>
                            <div className="bg-gray-100 dark:bg-neutral-900 p-2 rounded">
                                <kbd className="bg-white dark:bg-black px-2 py-1 rounded text-xs">Ctrl+Enter</kbd> تبدیل به فاکتور
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-emerald-600">مثال عملی</h3>
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 border border-emerald-200 dark:border-emerald-800 rounded text-sm">
                            <div className="font-bold mb-2">📱 تعمیر موبایل سامسونگ A54</div>
                            <div className="space-y-1 text-xs">
                                <div>1️⃣ بیعانه: 500,000 تومان</div>
                                <div>2️⃣ قطعات: باتری (300,000) + گلس (50,000) = 350,000</div>
                                <div>3️⃣ دستمزد: 200,000 تومان</div>
                                <div>4️⃣ قیمت نهایی: 1,100,000 تومان</div>
                                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 mt-2">
                                    <div>مانده دریافتی: 600,000 تومان</div>
                                    <div className="text-emerald-600 dark:text-emerald-400 font-bold">سود خالص: 50,000 تومان ✅</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded text-sm border border-blue-100 dark:border-blue-800">
                        <strong>ارتباط با سایر بخش‌ها:</strong> قطعات از انبار کسر می‌شوند، پرداخت‌ها در خزانه‌داری ثبت می‌شوند و در صورت لینک به مشتری، در کاردکس او نمایش داده می‌شود.
                    </div>
                </div>
            )}

            {activeSection === 'database' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">دیتابیس و ذخیره‌سازی</h2>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-200 dark:border-blue-800 rounded">
                        <h3 className="font-bold text-blue-700 dark:text-blue-400 mb-2">🗄️ SQLite Database</h3>
                        <p className="text-sm">
                            حساب فلو از دیتابیس SQLite استفاده می‌کند که یک دیتابیس سبک، سریع و قابل اعتماد است. تمام اطلاعات شما در فایل <code className="bg-white dark:bg-black px-2 py-1 rounded">hesabflow.db</code> ذخیره می‌شود.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-purple-600">جداول دیتابیس</h3>
                        
                        <div className="grid gap-3">
                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">📦 products</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">کالاها با موجودی، قیمت خرید/فروش، تصاویر و تنظیمات قیمت‌گذاری هوشمند</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">👥 customers</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">مشتریان با مانده حساب، اطلاعات تماس و تاریخ ایجاد</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">💰 customer_transactions</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">تمام تراکنش‌های مشتری (فاکتور، پرداخت، چک) با refId و refType برای لینک به سند اصلی</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">🧾 invoices</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">فاکتورها با آیتم‌ها (JSON)، نوع، مبالغ و اطلاعات تسویه</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">📝 checks</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">چک‌ها با تصاویر (JSON array)، وضعیت و اطلاعات بانکی</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">🏦 bank_accounts</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">حساب‌های بانکی و صندوق‌ها با موجودی</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">🔧 repair_receipts</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">رسیدهای تعمیرات با قطعات مصرفی (JSON)، تصاویر و محاسبات مالی</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">🏭 productions</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">پروژه‌های تولید با مواد اولیه (JSON) و محاسبات هزینه</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">📊 product_history</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">تاریخچه تغییرات موجودی و قیمت کالاها</p>
                            </div>

                            <div className="border border-gray-200 dark:border-neutral-800 p-3 rounded">
                                <h4 className="font-bold text-sm mb-1">📋 system_logs</h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">لاگ تمام عملیات سیستم برای پیگیری و عیب‌یابی</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-emerald-600">ذخیره‌سازی تصاویر</h3>
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 border border-emerald-200 dark:border-emerald-800 rounded text-sm">
                            <p className="mb-2">تصاویر به صورت Base64 در دیتابیس ذخیره می‌شوند:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li><strong>کالاها:</strong> فیلد <code>images</code> (TEXT) - آرایه JSON از Base64</li>
                                <li><strong>چک‌ها:</strong> فیلد <code>images</code> (TEXT) - آرایه JSON از Base64</li>
                                <li><strong>رسیدها:</strong> فیلدهای <code>receiptImages</code>, <code>repairImages</code>, <code>deliveryImages</code></li>
                            </ul>
                            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                ⚠️ توجه: تصاویر با کیفیت بالا حجم دیتابیس را افزایش می‌دهند. توصیه می‌شود از تصاویر با رزولوشن متوسط استفاده کنید.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-amber-600">پشتیبان‌گیری</h3>
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 border border-amber-200 dark:border-amber-800 rounded">
                            <p className="text-sm mb-2">برای پشتیبان‌گیری از اطلاعات:</p>
                            <ol className="list-decimal list-inside space-y-1 text-sm">
                                <li>به بخش "تنظیمات" بروید</li>
                                <li>روی "پشتیبان‌گیری از دیتابیس" کلیک کنید</li>
                                <li>مکان ذخیره را انتخاب کنید</li>
                                <li>فایل <code>hesabflow_backup_[تاریخ].db</code> ذخیره می‌شود</li>
                            </ol>
                            <p className="text-xs mt-2 text-amber-700 dark:text-amber-500">
                                💡 توصیه: هر هفته یکبار پشتیبان بگیرید و در مکان امنی نگهداری کنید.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-red-600">Migration از JSON</h3>
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 border border-red-200 dark:border-red-800 rounded text-sm">
                            <p className="mb-2">اگر از نسخه قدیمی (JSON-based) استفاده می‌کردید:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>سیستم به صورت خودکار داده‌های قدیمی را تشخیص می‌دهد</li>
                                <li>یک بار Migration اجرا می‌شود و داده‌ها به SQLite منتقل می‌شوند</li>
                                <li>فایل‌های JSON قدیمی حفظ می‌شوند (به عنوان backup)</li>
                                <li>پس از Migration موفق، سیستم از SQLite استفاده می‌کند</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {activeSection === 'troubleshooting' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">عیب‌یابی و رفع مشکل</h2>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-200 dark:border-blue-800 rounded">
                        <h3 className="font-bold text-blue-700 dark:text-blue-400 mb-2">🔍 Console Browser</h3>
                        <p className="text-sm mb-2">
                            برای مشاهده لاگ‌های سیستم و عیب‌یابی، Console مرورگر را باز کنید:
                        </p>
                        <div className="bg-white dark:bg-black p-2 rounded text-xs font-mono">
                            <div>Windows/Linux: <kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">F12</kbd> یا <kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Ctrl+Shift+I</kbd></div>
                            <div>Mac: <kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Cmd+Option+I</kbd></div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-red-600">مشکلات رایج و راه‌حل</h3>
                        
                        <div className="border-r-4 border-red-500 pr-3">
                            <h4 className="font-bold text-sm">❌ خطا در ذخیره اطلاعات مشتری</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>علت:</strong> مشتری با همین نام قبلاً ثبت شده یا دیتابیس قفل است.
                            </p>
                            <p className="text-sm mt-1">
                                <strong>راه‌حل:</strong> نام دیگری انتخاب کنید یا برنامه را ببندید و دوباره باز کنید.
                            </p>
                        </div>

                        <div className="border-r-4 border-amber-500 pr-3">
                            <h4 className="font-bold text-sm">⚠️ موجودی کافی نیست</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>علت:</strong> تعداد درخواستی بیشتر از موجودی انبار است.
                            </p>
                            <p className="text-sm mt-1">
                                <strong>راه‌حل:</strong> ابتدا فاکتور خرید ثبت کنید یا موجودی را از بخش "تعدیل موجودی" افزایش دهید.
                            </p>
                        </div>

                        <div className="border-r-4 border-blue-500 pr-3">
                            <h4 className="font-bold text-sm">🔵 مانده مشتری اشتباه است</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>علت:</strong> ممکن است تراکنشی دوبار ثبت شده یا چکی دوبار پاس شده باشد.
                            </p>
                            <p className="text-sm mt-1">
                                <strong>راه‌حل:</strong> کاردکس مشتری را بررسی کنید و تراکنش‌های تکراری را حذف کنید. در Console دنبال پیام‌های خطا بگردید.
                            </p>
                        </div>

                        <div className="border-r-4 border-purple-500 pr-3">
                            <h4 className="font-bold text-sm">🟣 چک دوبار مانده را تغییر داد</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>علت:</strong> این باگ در نسخه‌های قدیمی وجود داشت و در آخرین نسخه رفع شده.
                            </p>
                            <p className="text-sm mt-1">
                                <strong>راه‌حل:</strong> وضعیت چک را به "در جریان" برگردانید، سپس دوباره "پاس شده" کنید. حالا فقط یکبار تراکنش ثبت می‌شود.
                            </p>
                        </div>

                        <div className="border-r-4 border-emerald-500 pr-3">
                            <h4 className="font-bold text-sm">🟢 تصاویر نمایش داده نمی‌شوند</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>علت:</strong> فایل تصویر خیلی بزرگ است یا فرمت پشتیبانی نمی‌شود.
                            </p>
                            <p className="text-sm mt-1">
                                <strong>راه‌حل:</strong> از تصاویر با حجم کمتر از 2MB و فرمت JPG/PNG استفاده کنید.
                            </p>
                        </div>

                        <div className="border-r-4 border-gray-500 pr-3">
                            <h4 className="font-bold text-sm">⚫ برنامه کند شده است</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <strong>علت:</strong> حجم دیتابیس زیاد شده یا تصاویر زیادی ذخیره شده.
                            </p>
                            <p className="text-sm mt-1">
                                <strong>راه‌حل:</strong> از بخش تنظیمات "بهینه‌سازی دیتابیس" را اجرا کنید. لاگ‌های قدیمی را حذف کنید.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-600">بررسی سلامت دیتابیس</h3>
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 border border-blue-200 dark:border-blue-800 rounded">
                            <p className="text-sm mb-2">برای بررسی سلامت دیتابیس:</p>
                            <ol className="list-decimal list-inside space-y-1 text-sm">
                                <li>Console را باز کنید (F12)</li>
                                <li>به تب "Console" بروید</li>
                                <li>دنبال پیام‌های با علامت ❌ بگردید</li>
                                <li>اگر خطای "Database not initialized" دیدید، برنامه را ببندید و دوباره باز کنید</li>
                                <li>اگر خطای "SQLITE_BUSY" دیدید، چند ثانیه صبر کنید و دوباره تلاش کنید</li>
                            </ol>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-emerald-600">لاگ‌های سیستم</h3>
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 border border-emerald-200 dark:border-emerald-800 rounded text-sm">
                            <p className="mb-2">تمام عملیات مهم در بخش "لاگ سیستم" ثبت می‌شوند:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>✅ عملیات موفق با علامت سبز</li>
                                <li>🔵 تغییر وضعیت با علامت آبی</li>
                                <li>🟡 هشدارها با علامت زرد</li>
                                <li>❌ خطاها با علامت قرمز</li>
                            </ul>
                            <p className="mt-2 text-xs">
                                برای عیب‌یابی، لاگ‌های اخیر را بررسی کنید و ببینید کدام عملیات با خطا مواجه شده.
                            </p>
                        </div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/10 p-4 border border-red-200 dark:border-red-800 rounded">
                        <h3 className="font-bold text-red-700 dark:text-red-500 mb-2">🆘 پشتیبانی</h3>
                        <p className="text-sm">
                            اگر مشکل شما حل نشد، لطفاً:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                            <li>Screenshot از Console (F12) بگیرید</li>
                            <li>لاگ‌های سیستم را Export کنید</li>
                            <li>شرح دقیق مشکل را بنویسید</li>
                            <li>با تیم پشتیبانی تماس بگیرید</li>
                        </ol>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-purple-600">نکات مهم</h3>
                        <div className="grid gap-2 text-sm">
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-3 border border-purple-200 dark:border-purple-800 rounded">
                                💡 همیشه قبل از عملیات مهم، پشتیبان بگیرید
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-3 border border-purple-200 dark:border-purple-800 rounded">
                                💡 از بستن ناگهانی برنامه در حین ذخیره‌سازی خودداری کنید
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-3 border border-purple-200 dark:border-purple-800 rounded">
                                💡 Console را باز نگه دارید تا مشکلات را سریع‌تر تشخیص دهید
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-3 border border-purple-200 dark:border-purple-800 rounded">
                                💡 هر ماه یکبار لاگ‌های قدیمی را پاک کنید
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
