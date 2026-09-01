
import React, { useState, useEffect, useMemo } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Production, Product, InvoiceItem, ProjectNote } from '../../types';
import { X, PlayCircle, Plus, Camera, Save, Clock, Package, CheckCircle, StickyNote, Trash2, Search, TrendingUp, DollarSign, ArrowRightLeft, Maximize2 } from 'lucide-react';
import { ImageViewer } from '../ui/ImageViewer';
import { normalizeDateToPersian } from '../../utils/dateUtils';

interface ProjectManagerProps {
  windowId: string;
  productionId: string;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ windowId, productionId }) => {
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const { productions, products, updateProduction, completeProduction } = useDataStore();
  const { showToast, confirm } = useUIStore();
  
  const project = productions.find(p => p.id === productionId);
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'notes' | 'photos' | 'financial'>('overview');
  
  // New Material State
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const filteredProducts = products.filter(p => p.name.includes(productSearch) || (p.sku && p.sku.includes(productSearch)));

  // Note State
  const [newNote, setNewNote] = useState('');

  // Editable Sell Price State
  const [manualSellPrice, setManualSellPrice] = useState<string>('');

  // Image Viewer State
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // Time Calculation
  const [elapsedTime, setElapsedTime] = useState('');
  // Force update for timer
  const [tick, setTick] = useState(0);

  useEffect(() => {
      if (!project) return;
      if (project.suggestedSellPrice && !manualSellPrice) {
          setManualSellPrice(project.suggestedSellPrice.toString());
      }
  }, [project]);

  useEffect(() => {
      if (!project) return;
      const calculateTime = () => {
          const start = new Date(project.startDate).getTime();
          if (isNaN(start)) {
              setElapsedTime('نامعتبر');
              return;
          }
          const now = new Date().getTime();
          const diff = now - start;
          
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          
          setElapsedTime(`${days} روز، ${hours} ساعت، ${minutes} دقیقه`);
      };

      calculateTime();
      const interval = setInterval(() => {
          setTick(t => t + 1); // Force re-render
          calculateTime();
      }, 60000); // Update every minute
      
      return () => clearInterval(interval);
  }, [project, tick]);

  // Financial Analysis
  const financials = useMemo(() => {
      if (!project) return null;

      // 1. Current value of raw materials if sold (Opportunity Cost)
      let rawMaterialSellValue = 0;
      project.rawMaterials.forEach(item => {
          const currentProduct = products.find(p => p.id === item.productId);
          const sellPrice = currentProduct ? currentProduct.sellPrice : item.unitPrice * 1.2; // Fallback 20% if deleted
          rawMaterialSellValue += (item.quantity * sellPrice);
      });

      const totalProductionCost = project.totalRawMaterialCost + project.totalExternalCost + project.totalInternalCost;
      
      const finalSellPrice = parseInt(manualSellPrice.replace(/,/g, ''), 10) || project.suggestedSellPrice;
      const totalRevenue = finalSellPrice * project.quantity;

      const productionProfit = totalRevenue - totalProductionCost;
      const rawSaleProfit = rawMaterialSellValue - project.totalRawMaterialCost; // Profit if we just sold materials

      const opportunityDiff = productionProfit - rawSaleProfit; // Extra value created by production

      // Margins
      const productionMargin = totalRevenue > 0 ? ((productionProfit / totalRevenue) * 100) : 0;

      return {
          rawMaterialSellValue,
          totalProductionCost,
          finalSellPrice,
          totalRevenue,
          productionProfit,
          rawSaleProfit,
          opportunityDiff,
          productionMargin
      };
  }, [project, products, manualSellPrice]);

  if (!project) return <div className="p-4 text-red-500">پروژه یافت نشد.</div>;

  const handleAddMaterial = (product: Product) => {
      // Check stock availability
      if (product.stock < 1) {
          showToast('error', `موجودی ${product.name} کافی نیست (موجود: ${product.stock})`);
          return;
      }
      
      const newItem: InvoiceItem = {
          id: crypto.randomUUID(),
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.buyPrice,
          buyPriceSnapshot: product.buyPrice,
          discount: 0,
          tax: 0,
          total: product.buyPrice
      };
      
      const currentMaterials = project.rawMaterials || [];
      const updatedMaterials = [...currentMaterials, newItem];
      
      const newRawCost = updatedMaterials.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
      const newTotal = newRawCost + project.totalExternalCost + project.totalInternalCost;
      const newUnitCost = newTotal / project.quantity;

      updateProduction(project.id, {
          rawMaterials: updatedMaterials,
          totalRawMaterialCost: newRawCost,
          finalCostPrice: Math.round(newUnitCost)
      }, { added: [newItem] });

      setShowProductModal(false);
      showToast('success', 'مواد اولیه اضافه و از انبار کسر شد');
  };

  const handleRemoveMaterial = (itemId: string) => {
      const itemToRemove = project.rawMaterials.find(i => i.id === itemId);
      if (!itemToRemove) return;

      confirm({
          title: 'حذف مواد اولیه',
          message: `آیا از حذف "${itemToRemove.productName}" اطمینان دارید؟ موجودی به انبار بازمی‌گردد.`,
          confirmText: 'حذف و بازگشت به انبار',
          variant: 'danger',
          onConfirm: () => {
              const updatedMaterials = project.rawMaterials.filter(i => i.id !== itemId);
              const newRawCost = updatedMaterials.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
              const newTotal = newRawCost + project.totalExternalCost + project.totalInternalCost;
              const newUnitCost = newTotal / project.quantity;

              updateProduction(project.id, {
                  rawMaterials: updatedMaterials,
                  totalRawMaterialCost: newRawCost,
                  finalCostPrice: Math.round(newUnitCost)
              }, { removed: [itemToRemove] });

              showToast('info', 'کالا حذف و موجودی به انبار برگشت');
          }
      });
  };

  const handleUpdateSellPrice = () => {
      if (financials) {
          updateProduction(project.id, {
              suggestedSellPrice: financials.finalSellPrice
          });
          showToast('success', 'قیمت فروش بروزرسانی شد');
      }
  };

  const handleAddNote = () => {
      if (!newNote.trim()) return;
      const note: ProjectNote = {
          id: crypto.randomUUID(),
          date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
          time: new Date().toLocaleTimeString('fa-IR-u-nu-latn', {hour:'2-digit', minute:'2-digit'}),
          text: newNote
      };
      const updatedNotes = [...(project.notes || []), note];
      updateProduction(project.id, { notes: updatedNotes });
      setNewNote('');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          let uploadedCount = 0;
          const newPhotos: string[] = [];
          
          Array.from(files).forEach((file) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  newPhotos.push(reader.result as string);
                  uploadedCount++;
                  
                  // When all files are read, update state once
                  if (uploadedCount === files.length) {
                      const updatedPhotos = [...(project.photos || []), ...newPhotos];
                      updateProduction(project.id, { photos: updatedPhotos });
                      showToast('success', `${files.length} عکس با موفقیت آپلود شد`);
                  }
              };
              reader.readAsDataURL(file);
          });
      }
  };

  const handleDeletePhoto = (index: number) => {
      confirm({
          title: 'حذف عکس',
          message: 'آیا از حذف این عکس اطمینان دارید؟',
          confirmText: 'حذف',
          variant: 'danger',
          onConfirm: () => {
              const updatedPhotos = project.photos?.filter((_, i) => i !== index) || [];
              updateProduction(project.id, { photos: updatedPhotos });
              showToast('info', 'عکس حذف شد');
          }
      });
  };

  const handleViewPhoto = (photo: string, index: number) => {
      setSelectedImage(photo);
      setSelectedImageIndex(index);
      setShowImageViewer(true);
  };

  const handleFinishProject = () => {
      confirm({
          title: 'اتمام پروژه',
          message: 'آیا از اتمام پروژه و انتقال محصول نهایی به انبار اطمینان دارید؟',
          confirmText: 'بله، پایان پروژه',
          onConfirm: () => {
              // Ensure latest price is saved before completing
              if (financials) {
                  updateProduction(project.id, { suggestedSellPrice: financials.finalSellPrice });
              }
              completeProduction(project.id);
              showToast('success', 'پروژه تکمیل شد.');
              closeWindow(windowId);
          }
      });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
        {/* Header */}
        <div className="bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800 p-4 flex justify-between items-center shadow-sm">
            <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <PlayCircle className="text-blue-500 animate-pulse" />
                    {project.productName}
                </h2>
                <div className="flex gap-4 text-xs text-gray-500 mt-1">
                    <span className="font-mono">SKU: {project.sku || '-'}</span>
                    <span>تعداد: {project.quantity}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                        <Clock size={12} />
                        مدت زمان: {elapsedTime}
                    </span>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handleFinishProject}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center gap-2 shadow-lg"
                >
                    <CheckCircle size={16} />
                    اتمام و ثبت نهایی
                </button>
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-16 bg-white dark:bg-neutral-800 border-l border-gray-200 dark:border-neutral-700 flex flex-col items-center py-4 gap-4">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`p-2 rounded-lg transition-all ${activeTab === 'overview' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}
                    title="نمای کلی"
                >
                    <Package size={20} />
                </button>
                <button 
                    onClick={() => setActiveTab('financial')}
                    className={`p-2 rounded-lg transition-all ${activeTab === 'financial' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}
                    title="تحلیل مالی"
                >
                    <TrendingUp size={20} />
                </button>
                <button 
                    onClick={() => setActiveTab('materials')}
                    className={`p-2 rounded-lg transition-all ${activeTab === 'materials' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}
                    title="مواد اولیه"
                >
                    <Plus size={20} />
                </button>
                <button 
                    onClick={() => setActiveTab('notes')}
                    className={`p-2 rounded-lg transition-all ${activeTab === 'notes' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}
                    title="یادداشت‌ها"
                >
                    <StickyNote size={20} />
                </button>
                <button 
                    onClick={() => setActiveTab('photos')}
                    className={`p-2 rounded-lg transition-all ${activeTab === 'photos' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}
                    title="تصاویر"
                >
                    <Camera size={20} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-surface p-4 rounded border border-gray-200 dark:border-neutral-700 shadow-sm">
                                <div className="text-xs text-gray-500 mb-1">هزینه مواد اولیه</div>
                                <div className="text-xl font-black font-mono">{project.totalRawMaterialCost.toLocaleString()}</div>
                            </div>
                            <div className="bg-white dark:bg-surface p-4 rounded border border-gray-200 dark:border-neutral-700 shadow-sm">
                                <div className="text-xs text-gray-500 mb-1">سربار و هزینه‌ها</div>
                                <div className="text-xl font-black font-mono">{(project.totalExternalCost + project.totalInternalCost).toLocaleString()}</div>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                                <div className="text-xs text-emerald-600 mb-1">قیمت تمام شده (واحد)</div>
                                <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">{project.finalCostPrice.toLocaleString()}</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface p-4 rounded border border-gray-200 dark:border-neutral-700">
                            <h3 className="font-bold text-sm mb-4">وضعیت مصرف</h3>
                            <div className="space-y-2">
                                {project.rawMaterials.slice(0, 5).map(item => (
                                    <div key={item.id} className="flex justify-between text-sm border-b border-gray-100 dark:border-neutral-800 pb-2 last:border-0">
                                        <span>{item.productName}</span>
                                        <span className="font-mono">{item.quantity} عدد</span>
                                    </div>
                                ))}
                                {project.rawMaterials.length > 5 && <div className="text-center text-xs text-gray-400">... و {project.rawMaterials.length - 5} مورد دیگر</div>}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'financial' && financials && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            {/* Analysis Card */}
                            <div className="bg-white dark:bg-surface p-5 rounded border border-gray-200 dark:border-neutral-700">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <ArrowRightLeft size={18} />
                                    مقایسه سودآوری (تحلیل هزینه فرصت)
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded">
                                        <div>
                                            <span className="block text-xs font-bold text-amber-700 dark:text-amber-500">اگر مواد اولیه را بفروشید</span>
                                            <span className="text-[10px] text-gray-500">ارزش بازار مواد مصرفی - هزینه خرید</span>
                                        </div>
                                        <div className="text-lg font-black font-mono text-amber-800 dark:text-amber-400">
                                            {financials.rawSaleProfit.toLocaleString()} <span className="text-[10px]">سود</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded">
                                        <div>
                                            <span className="block text-xs font-bold text-blue-700 dark:text-blue-500">اگر محصول نهایی را بفروشید</span>
                                            <span className="text-[10px] text-gray-500">درآمد کل فروش - هزینه کل تولید</span>
                                        </div>
                                        <div className="text-lg font-black font-mono text-blue-800 dark:text-blue-400">
                                            {financials.productionProfit.toLocaleString()} <span className="text-[10px]">سود</span>
                                        </div>
                                    </div>

                                    <div className={`p-4 rounded border-2 text-center ${financials.opportunityDiff > 0 ? 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'border-red-100 bg-red-50 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
                                        <div className="text-xs font-bold mb-1">ارزش افزوده تولید (اختلاف سود)</div>
                                        <div className="text-2xl font-black font-mono" dir="ltr">
                                            {financials.opportunityDiff > 0 ? '+' : ''}{financials.opportunityDiff.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] mt-1 opacity-80">
                                            {financials.opportunityDiff > 0 ? 'تولید این محصول به‌صرفه است' : 'فروش مواد اولیه سود بیشتری دارد!'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Settings Card */}
                            <div className="bg-white dark:bg-surface p-5 rounded border border-gray-200 dark:border-neutral-700">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <DollarSign size={18} />
                                    تنظیمات قیمت و سود
                                </h3>
                                
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">قیمت فروش هر واحد محصول</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={manualSellPrice ? Number(manualSellPrice).toLocaleString() : ''}
                                            onChange={e => setManualSellPrice(e.target.value.replace(/,/g, ''))}
                                            className="flex-1 p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded text-center font-bold font-mono outline-none focus:border-blue-500"
                                            placeholder="0"
                                        />
                                        <button 
                                            onClick={handleUpdateSellPrice}
                                            className="bg-blue-600 text-white px-3 rounded text-xs font-bold hover:bg-blue-700"
                                        >
                                            تایید
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm border-t border-gray-100 dark:border-neutral-800 pt-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">قیمت تمام شده واحد:</span>
                                        <span className="font-mono">{project.finalCostPrice.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">حاشیه سود تولید:</span>
                                        <span className={`font-mono font-bold ${financials.productionMargin > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {financials.productionMargin.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                                        <span>ارزش کل فروش:</span>
                                        <span className="font-mono">{financials.totalRevenue.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'materials' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 dark:text-white">مدیریت مواد اولیه</h3>
                            <button 
                                onClick={() => setShowProductModal(true)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1"
                            >
                                <Plus size={14} /> افزودن متریال جدید
                            </button>
                        </div>
                        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-700 rounded overflow-hidden">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 dark:bg-neutral-900 text-xs text-gray-500">
                                    <tr>
                                        <th className="p-3">نام کالا</th>
                                        <th className="p-3 text-center">تعداد مصرفی</th>
                                        <th className="p-3 text-center">هزینه واحد</th>
                                        <th className="p-3 text-center">جمع کل</th>
                                        <th className="p-3 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {project.rawMaterials.map(item => (
                                        <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                                            <td className="p-3">{item.productName}</td>
                                            <td className="p-3 text-center font-mono">{item.quantity}</td>
                                            <td className="p-3 text-center font-mono">{item.unitPrice.toLocaleString()}</td>
                                            <td className="p-3 text-center font-mono font-bold">{item.total.toLocaleString()}</td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => handleRemoveMaterial(item.id)}
                                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="حذف و بازگشت به انبار"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                placeholder="یادداشت جدید..."
                                className="flex-1 p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none"
                            />
                            <button onClick={handleAddNote} className="px-4 bg-blue-600 text-white rounded hover:bg-blue-700">
                                <Save size={18} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {project.notes?.map(note => (
                                <div key={note.id} className="bg-white dark:bg-surface p-3 rounded border border-gray-200 dark:border-neutral-700 shadow-sm">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                        <span>{normalizeDateToPersian(note.date)}</span>
                                        <span>{note.time}</span>
                                    </div>
                                    <p className="text-sm text-gray-800 dark:text-gray-200">{note.text}</p>
                                </div>
                            ))}
                            {(!project.notes || project.notes.length === 0) && (
                                <div className="text-center text-gray-400 text-sm py-10">هیچ یادداشتی ثبت نشده است</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'photos' && (
                    <div className="space-y-4">
                        <label className="block w-full border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                            <Camera className="mx-auto text-gray-400 mb-2" size={32} />
                            <span className="text-sm text-gray-500">برای آپلود عکس کلیک کنید</span>
                            <p className="text-xs text-gray-400 mt-1">می‌توانید چند عکس همزمان انتخاب کنید</p>
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
                        </label>
                        {(!project.photos || project.photos.length === 0) ? (
                            <div className="text-center text-gray-400 text-sm py-10">هیچ عکسی آپلود نشده است</div>
                        ) : (
                            <div className="grid grid-cols-3 gap-4">
                                {project.photos.map((photo, idx) => (
                                    <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 relative group">
                                        <img src={photo} alt={`Project ${idx + 1}`} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleViewPhoto(photo, idx)}
                                                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-lg"
                                                title="نمایش بزرگ"
                                            >
                                                <Maximize2 size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePhoto(idx)}
                                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded shadow-lg"
                                                title="حذف"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center">
                                            عکس {idx + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>

        {/* Image Viewer Modal */}
        {showImageViewer && project.photos && project.photos.length > 0 && (
            <ImageViewer
                imageUrl={project.photos}
                title={`${project.productName} - گالری تصاویر`}
                initialIndex={selectedImageIndex}
                onClose={() => setShowImageViewer(false)}
            />
        )}

        {/* Product Selection Modal */}
        {showProductModal && (
            <div className="absolute inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8">
                <div className="bg-white dark:bg-surface w-full max-w-3xl h-[500px] flex flex-col rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-neutral-700">
                    <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center bg-gray-50 dark:bg-neutral-900">
                        <input 
                            autoFocus
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="جستجوی مواد اولیه..."
                            className="flex-1 text-lg font-bold bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
                        />
                        <button onClick={() => setShowProductModal(false)}><X className="text-gray-500 hover:text-red-500" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-right">
                            <thead className="text-xs text-gray-500 dark:text-gray-400 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 sticky top-0">
                                <tr>
                                    <th className="p-3">نام کالا</th>
                                    <th className="p-3">موجودی</th>
                                    <th className="p-3">قیمت خرید</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {filteredProducts.map(p => (
                                    <tr 
                                        key={p.id} 
                                        onClick={() => handleAddMaterial(p)}
                                        className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                    >
                                        <td className="p-3 font-bold text-sm text-gray-800 dark:text-white">{p.name}</td>
                                        <td className={`p-3 font-mono text-sm ${p.stock === 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>{p.stock}</td>
                                        <td className="p-3 font-mono text-sm text-gray-600 dark:text-gray-300">{p.buyPrice.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
