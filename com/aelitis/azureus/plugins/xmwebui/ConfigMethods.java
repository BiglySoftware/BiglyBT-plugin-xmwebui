/*
 * Copyright (C) Bigly Software.  All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

package com.aelitis.azureus.plugins.xmwebui;

import java.text.DecimalFormat;
import java.util.*;

import com.biglybt.core.internat.MessageText;
import com.biglybt.pifimpl.local.ui.config.*;
import com.biglybt.ui.config.*;
import com.biglybt.ui.swt.Utils;
import com.biglybt.util.MapUtils;

import com.biglybt.pif.ui.UIInstance;
import com.biglybt.pif.ui.config.*;
import com.biglybt.pif.ui.config.ParameterValidator.ValidationInfo;

import static com.aelitis.azureus.plugins.xmwebui.StaticUtils.addIfNotNull;

public class ConfigMethods
{
	static ConfigSections instance;

	public static void get(Map<String, Object> args, Map<String, Object> result) {

		//noinspection unchecked
		List<String> sections = MapUtils.getMapList(args, "sections", null);
		//noinspection unchecked
		List<String> parameters = MapUtils.getMapList(args, "parameters", null);

		if (sections != null || parameters == null) {
			getSections(sections, args, result);
		}

		if (parameters != null) {
			getParameters(parameters, result);
		}
	}

	public static void set(Map<String, Object> args, Map<String, Object> result)
			throws TextualException {
		Map<String, Object> parameters = MapUtils.getMapMap(args, "parameters",
				null);
		if (parameters == null) {
			throw new TextualException("No 'parameters' arg");
		}
		Map<String, Object> mapErrors = new HashMap<>();
		Map<String, Object> mapSuccess = new HashMap<>();
		result.put("success", mapSuccess);
		result.put("error", mapErrors);

		List<String> listSections = new ArrayList<>();
		for (String key : parameters.keySet()) {
			Object val = parameters.get(key);
			ParameterWithConfigSection pwcs = getParameter(key);
			if (pwcs != null) {
				if (!listSections.contains(pwcs.configSection)) {
					listSections.add(pwcs.configSection);
				}

				Parameter parameter = pwcs.parameter;
				boolean ok = false;
				if (!parameter.isEnabled()) {
					mapErrors.put(key, "Parameter is disabled");
				} else if (parameter instanceof ColorParameter) {
					mapErrors.put(key, "setting color not supported yet");
				} else if (parameter instanceof BooleanParameter) {
					ok = set((BooleanParameter) parameter, key, val, mapErrors);
				} else if (parameter instanceof DirectoryParameter) {
					ok = set((DirectoryParameter) parameter, key, val, mapErrors);
				} else if (parameter instanceof FileParameterImpl) {
					ok = set((FileParameterImpl) parameter, key, val, mapErrors);
				} else if (parameter instanceof FloatParameter) {
					ok = set((FloatParameter) parameter, key, val, mapErrors);
				} else if (parameter instanceof IntListParameter) {
					ok = set((IntListParameter) parameter, key, val, mapErrors);
				} else if (parameter instanceof IntParameter) {
					ok = set((IntParameter) parameter, key, val, mapErrors);
				} else if (parameter instanceof PasswordParameter) {
					ok = set((PasswordParameter) parameter, key, val, mapErrors);
				} else if (parameter instanceof StringListParameter) {
					ok = set((StringListParameter) parameter, key, val, mapErrors);
				} else if (parameter instanceof StringParameterImpl) {
					ok = set((StringParameterImpl) parameter, key, val, mapErrors);
				}

				if (ok) {
					Map<String, Object> paramAsMap = getParamAsMap(parameter,
							new ParamGroupInfo(), new Stack<>(), 99);
					paramAsMap.put("section-id", pwcs.configSection);
					mapSuccess.put(key, paramAsMap);
				}
			}
		}

		getSections(listSections, Collections.emptyMap(), result);
	}

	private static boolean set(StringParameterImpl parameter, String key,
			Object val, Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue((String) val);
		return true;
	}

	private static boolean set(StringListParameter parameter, String key,
			Object val, Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue((String) val);
		return true;
	}

	private static boolean set(PasswordParameter parameter, String key,
			Object val, Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue((String) val);
		return true;
	}

	private static boolean set(IntListParameter parameter, String key, Object val,
			Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue(((Number) val).intValue());
		return true;
	}

	private static boolean set(IntParameter parameter, String key, Object val,
			Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue(((Number) val).intValue());
		return true;
	}

	private static boolean set(FileParameterImpl parameter, String key,
			Object val, Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setFileName((String) val);
		return true;
	}

	private static boolean set(DirectoryParameter parameter, String key,
			Object val, Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue((String) val);
		return true;
	}

	private static boolean set(FloatParameter parameter, String key, Object val,
			Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue(((Number) val).floatValue());
		return true;
	}

	private static boolean set(BooleanParameter parameter, String key, Object val,
			Map<String, Object> mapErrors) {
		ValidationInfo validate = validate(parameter, val);
		if (!validate.valid) {
			mapErrors.put(key, validate.info);
			return false;
		}
		parameter.setValue(((Boolean) val).booleanValue());
		return true;
	}

	private static ValidationInfo validate(StringParameterImpl parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof String)) {
			return new ValidationInfo(false, "Parameter value must be String");
		}
		String newValue = (String) newValueObject;

		int textLimit = parameter.getTextLimit();
		if (textLimit > 0 && newValue.length() > textLimit) {
			return new ValidationInfo(false, "Parameter Max Length is " + textLimit);
		}

		String validCharsString = parameter.getValidChars();
		boolean validCharsCaseSensitive = parameter.isValidCharsCaseSensitive();

		if (validCharsString != null && validCharsString.length() > 0) {
			char[] validChars = new char[validCharsString.length()];
			validCharsString.getChars(0, validCharsString.length(), validChars, 0);
			Arrays.sort(validChars);

			int len = newValue.length();
			for (int i = 0; i < len; i++) {
				char c = newValue.charAt(i);
				if ((Arrays.binarySearch(validChars, c) < 0)
						|| (!validCharsCaseSensitive && (Arrays.binarySearch(validChars,
								Character.toLowerCase(c)) < 0))) {
					return new ValidationInfo(false,
							"Value contains invalid characters. Not allowed: "
									+ validCharsString);
				}
			}
		}

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(StringListParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof String)) {
			return new ValidationInfo(false, "Parameter value must be Number");
		}
		String newValue = (String) newValueObject;

		String[] values = parameter.getValues();
		boolean found = false;
		for (String value : values) {
			if (value != null && value.equals(newValue)) {
				found = true;
				break;
			}
		}
		if (!found) {
			return new ValidationInfo(false, "Value not in list");
		}

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(PasswordParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof String)) {
			return new ValidationInfo(false, "Parameter value must be String");
		}
		String newValue = (String) newValueObject;

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(IntParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof Number)) {
			return new ValidationInfo(false, "Parameter value must be Number");
		}

		int newValue = ((Number) newValueObject).intValue();

		// Note: ParameterImpl.validate doesn't validate ranges, that code is still
		//       in IntSWTParameter :(  Copied below

		if (parameter.isLimited()) {
			int iMaxValue = parameter.getMaxValue();
			if (iMaxValue != Integer.MAX_VALUE && newValue > iMaxValue) {
				return new ValidationInfo(false, "Max " + iMaxValue);
			}

			int iMinValue = parameter.getMinValue();
			if (iMinValue != Integer.MIN_VALUE && newValue < iMinValue) {
				return new ValidationInfo(false, "Min " + iMinValue);
			}
		}

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(IntListParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof Number)) {
			return new ValidationInfo(false, "Parameter value must be Number");
		}
		int newValue = ((Number) newValueObject).intValue();

		int[] values = parameter.getValues();
		boolean found = false;
		for (int value : values) {
			if (value == newValue) {
				found = true;
				break;
			}
		}
		if (!found) {
			return new ValidationInfo(false, "Value not in list");
		}

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(DirectoryParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof String)) {
			return new ValidationInfo(false, "Parameter value must be String");
		}
		String newValue = (String) newValueObject;

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(FileParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof String)) {
			return new ValidationInfo(false, "Parameter value must be String");
		}
		String newValue = (String) newValueObject;

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(FloatParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof Number)) {
			return new ValidationInfo(false, "Parameter value must be Number");
		}

		float newValue = ((Number) newValueObject).floatValue();

		// Note: ParameterImpl.validate doesn't validate ranges, that code is still
		//       in FloatSWTParameter :(  Copied below

		if (!parameter.isAllowZero() && newValue == 0) {
			return new ValidationInfo(false,
					MessageText.getString("warning.zero.not.allowed"));
		}
		float fMinValue = parameter.getMinValue();
		if (newValue < fMinValue) {
			return new ValidationInfo(false,
					MessageText.getString("warning.min", new String[] {
						getDecimalFormat(parameter).format(fMinValue)
					}));
		}
		float fMaxValue = parameter.getMaxValue();
		if (newValue > fMaxValue && fMaxValue > -1) {
			return new ValidationInfo(false,
					MessageText.getString("warning.max", new String[] {
						getDecimalFormat(parameter).format(fMaxValue)
					}));
		}

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static ValidationInfo validate(BooleanParameter parameter,
			Object newValueObject) {
		if (!(newValueObject instanceof Boolean)) {
			return new ValidationInfo(false, "Parameter value must be Boolean");
		}
		boolean newValue = (Boolean) newValueObject;

		if (parameter instanceof ParameterImpl) {
			return ((ParameterImpl) parameter).validate(newValue);
		}
		return new ValidationInfo(true);
	}

	private static DecimalFormat getDecimalFormat(FloatParameter parameter) {
		int digitsAfterDecimal = parameter.getNumDigitsAfterDecimal();
		DecimalFormat df = new DecimalFormat(
				digitsAfterDecimal > 0 ? "0.000000000000" : "0");
		df.setGroupingUsed(false);
		df.setMaximumFractionDigits(digitsAfterDecimal);
		return df;
	}

	private static String getFriendlyConfigSectionID(String id) {
		final String[] squashSUffixes = new String[] {
			".name",
			".title",
			".title.full"
		};
		for (String squashSUffix : squashSUffixes) {
			if (id.endsWith(squashSUffix)) {
				return id.substring(0, id.length() - squashSUffix.length());
			}
		}
		return id;
	}

	private static Map<String, Object> getParamAsMap(Parameter param,
			final ParamGroupInfo pgInfo, Stack<ParamGroupInfo> pgInfoStack,
			int maxUserModeRequested) {

		List<Map<String, Object>> list = pgInfo.list;

		boolean paramEnabled = pgInfo.isEnabled(param);
		Map<String, Object> out = new HashMap<>();
		out.put("enabled", paramEnabled);
		int minimumRequiredUserMode = param.getMinimumRequiredUserMode();
		if (minimumRequiredUserMode > 0) {
			out.put("min-user-mode", minimumRequiredUserMode);
		}

		if ((param instanceof ParameterGroupImpl)
				&& param.getMinimumRequiredUserMode() <= maxUserModeRequested) {
			String rid = ((ParameterGroup) param).getGroupTitleKey();

			pgInfoStack.push(pgInfo.copy());

			pgInfo.reset((ParameterGroupImpl) param);
			if (rid == null) {
				pgInfo.list = list;
			}

			if (param.isVisible() && rid != null) {
				String title = MessageText.getString(rid);

				out.put("type", "Group");
				out.put("title", title);
				out.put("parameters", pgInfo.list);
				out.put("id", rid);
				out.put("col-hint", ((ParameterGroupImpl) param).getNumberColumns());
				addIfNotNull(out, "key", param.getConfigKeyName());
				addIfNotNull(out, "ref-id", ((ParameterImpl) param).getReferenceID());
				list.add(out);
			}

			return out;
		}

		boolean endGroup = false;
		if (pgInfo.numParamsLeft > 0) {
			pgInfo.numParamsLeft--;
			endGroup = pgInfo.numParamsLeft == 0;
		}

		try {
			if (param.getMinimumRequiredUserMode() > maxUserModeRequested) {
				return out;
			}

			String key = param.getConfigKeyName();

			if (key != null && (param instanceof ParameterImpl)) {
				ParameterImpl parami = (ParameterImpl) param;
				List<Parameter> enabledOnSelectionParameters = parami.getEnabledOnSelectionParameters();
				for (Parameter p : enabledOnSelectionParameters) {
					List<EnablerParameter> enablerParameters = pgInfo.mapEnableParams.get(
							p);
					//noinspection Java8MapApi
					if (enablerParameters == null) {
						enablerParameters = new ArrayList<>();
						pgInfo.mapEnableParams.put(p, enablerParameters);
					}
					enablerParameters.add(parami);
				}

				List<Parameter> disabledOnSelectionParameters = parami.getDisabledOnSelectionParameters();
				for (Parameter p : disabledOnSelectionParameters) {
					List<EnablerParameter> disablerParameters = pgInfo.mapDisableParams.get(
							p);
					//noinspection Java8MapApi
					if (disablerParameters == null) {
						disablerParameters = new ArrayList<>();
						pgInfo.mapDisableParams.put(p, disablerParameters);
					}
					disablerParameters.add(parami);
				}
			}

			if (!param.isVisible() || !pgInfo.visible) {
				return out;
			}
			if ((param instanceof ParameterImpl)
					&& !((ParameterImpl) param).isForUIType(UIInstance.UIT_CONSOLE)) {
				return out;
			}

			String paramType = getParamType(param);
			out.put("type", paramType);

			if (key != null) {
				out.put("key", key);
			}

			boolean canSet = true;

			if (param instanceof PasswordParameter) {
				byte[] value = ((PasswordParameter) param).getValue();
				boolean isSet = value != null && value.length > 0;
				out.put("is-set", isSet);
				out.put("width-hint",
						((PasswordParameter) param).getWidthInCharacters());

			} else if (param instanceof HyperlinkParameter) {
				canSet = false;
				String hyperlink = ((HyperlinkParameter) param).getHyperlink();

				String linkTextKey = ((HyperlinkParameter) param).getLinkTextKey();
				if (linkTextKey != null && !linkTextKey.isEmpty()) {
					String linkText = MessageText.getString(linkTextKey);
					if (!linkText.equals(hyperlink)) {
						out.put("hyperlink-title", linkText);
					}
				}
				out.put("hyperlink", hyperlink);

			} else if (param instanceof ActionParameter) {
				canSet = false;
				String actionResource = ((ActionParameter) param).getActionResource();
				out.put("text", MessageText.getString(actionResource));
				out.put("action-id", ((ActionParameter) param).getActionID());
				int style = ((ActionParameter) param).getStyle();
				out.put("style", style == ActionParameter.STYLE_BUTTON ? "Button"
						: style == ActionParameter.STYLE_LINK ? "Link" : null);
			}

			if (param instanceof DirectoryParameterImpl) {
				String keyDialogTitle = ((DirectoryParameterImpl) param).getKeyDialogTitle();
				if (keyDialogTitle != null) {
					out.put("dialog-title", MessageText.getString(keyDialogTitle));
				}
				String keyDialogMessage = ((DirectoryParameterImpl) param).getKeyDialogMessage();
				if (keyDialogMessage != null) {
					out.put("dialog-message", MessageText.getString(keyDialogMessage));
				}
			} else if (param instanceof FileParameterImpl) {
				String keyDialogTitle = ((FileParameterImpl) param).getKeyDialogTitle();
				if (keyDialogTitle != null) {
					out.put("dialog-title", MessageText.getString(keyDialogTitle));
				}
				addIfNotNull(out, "val-hint",
						((FileParameterImpl) param).getFileNameHint());
				addIfNotNull(out, "file-exts",
						((FileParameterImpl) param).getFileExtensions());

			} else if (param instanceof FloatParameter) {
				FloatParameter floatParam = (FloatParameter) param;
				out.put("allow-zero", floatParam.isAllowZero());
				//noinspection SimplifiableConditionalExpression
				boolean isLimited = (param instanceof FloatParameterImpl)
						? ((FloatParameterImpl) param).isLimited() : true;
				if (isLimited) {
					out.put("min", floatParam.getMinValue());
					out.put("max", floatParam.getMaxValue());
				}
				out.put("fractional-digits", floatParam.getNumDigitsAfterDecimal());

			} else if (param instanceof IntListParameter) {
				String[] labels = ((IntListParameter) param).getLabels();
				int[] vals = ((IntListParameter) param).getValues();
				out.put("style",
						listTypeToString(((IntListParameter) param).getListType()));
				out.put("labels", labels);
				out.put("vals", vals);

			} else if (param instanceof IntParameter) {
				// Note: Some IntParameters are stored as string
				IntParameter intParameter = (IntParameter) param;
				if (intParameter.isLimited()) {
					out.put("min", intParameter.getMinValue());
					int maxValue = intParameter.getMaxValue();
					if (maxValue != Integer.MAX_VALUE) {
						out.put("max", maxValue);
					}
				}

			} else if (param instanceof StringListParameter) {
				StringListParameter stringListParameter = (StringListParameter) param;
				String[] labels = stringListParameter.getLabels();
				String[] vals = stringListParameter.getValues();
				out.put("style", listTypeToString(stringListParameter.getListType()));
				out.put("labels", labels);
				out.put("vals", vals);

			} else if (param instanceof StringParameter) {
				StringParameter stringParameter = (StringParameter) param;
				int textLimit = stringParameter.getTextLimit();
				if (textLimit > 0) {
					out.put("text-limit", textLimit);
				}
				int widthInCharacters = stringParameter.getWidthInCharacters();
				if (widthInCharacters > 0) {
					out.put("width-hint", widthInCharacters);
				}
				if (param instanceof StringParameterImpl) {
					out.put("multiline", ((StringParameterImpl) param).getMultiLine());
					String validChars = ((StringParameterImpl) param).getValidChars();
					if (validChars != null) {
						out.put("valid-case-sensitive",
								((StringParameterImpl) param).isValidCharsCaseSensitive());
						out.put("valid-chars", validChars);
					}
				}
			}

			if (canSet) {
				Object val = param.getValueObject();
				if (val != null) {
					out.put("val", val);
				}

				out.put("set", param.hasBeenSet());
			}

			if (param instanceof ParameterWithHint) {
				String hintKey = ((ParameterWithHint) param).getHintKey();
				if (hintKey != null) {
					out.put("hint", MessageText.getString(hintKey));
				}
			}

			if (param instanceof ParameterWithSuffix) {
				String suffixLabelKey = ((ParameterWithSuffix) param).getSuffixLabelKey();
				if (suffixLabelKey != null) {
					out.put("label-suffix", MessageText.getString(suffixLabelKey));
				}
			}

			String label = param.getLabelText();
			if (label != null) {
				out.put("label", label);
				String tt = MessageText.getString(param.getLabelKey() + ".tooltip",
						(String) null);
				if (tt != null) {
					out.put("label-tooltip", tt);
				}
			}

			if (param instanceof ParameterImpl) {
				int indent = ((ParameterImpl) param).getIndent();
				if (indent > 0) {
					out.put("indent", indent);
					boolean fancy = ((ParameterImpl) param).isIndentFancy();
					if (fancy) {
						out.put("indent-style", "Fancy");
					}
				}
			}

			list.add(out);

		} finally {

			while (endGroup) {

				if (pgInfo.id != null) {
					// End Group Here
				}

				if (!pgInfoStack.isEmpty()) {
					ParamGroupInfo pgInfoPop = pgInfoStack.pop();
					if (pgInfoPop != null) {
						pgInfo.set(pgInfoPop);
						endGroup = pgInfo.numParamsLeft < 0;
					} else {
						endGroup = true;
					}
				} else {
					endGroup = false;
				}
			}
		}
		return out;
	}

	private static String getParamType(Parameter param) {
		String paramType = param.getClass().getSimpleName();
		if (paramType.endsWith("Impl")) {
			if (paramType.endsWith("ParameterImpl")) {
				paramType = paramType.substring(0, paramType.length() - 13);
			} else {
				paramType = paramType.substring(0, paramType.length() - 4);
			}
		}
		return paramType;
	}

	private static ParameterWithConfigSection getParameter(String configKey) {
		List<BaseConfigSection> sections = ConfigSections.getInstance().getAllConfigSections(
				false);
		for (BaseConfigSection section : sections) {
			boolean needsBuild = !section.isBuilt();
			try {
				if (needsBuild) {
					section.build();
					section.postBuild();
				}

				ParameterImpl pluginParam = section.getPluginParam(configKey);
				if (pluginParam != null) {
					return new ParameterWithConfigSection(section.getConfigSectionID(),
							pluginParam);
				}
			} finally {
				if (needsBuild) {
					section.deleteConfigSection();
				}
			}
		}
		return null;
	}

	static void getParameters(List<String> parameters,
			Map<String, Object> result) {
		Collections.sort(parameters);
		int numParametersLeft = parameters.size();
		List<BaseConfigSection> allConfigSections = ConfigSections.getInstance().getAllConfigSections(
				false);

		Map<String, Object> out = new HashMap<>();
		result.put("parameters", out);

		for (BaseConfigSection section : allConfigSections) {
			Stack<ParamGroupInfo> pgInfoStack = new Stack<>();
			ParamGroupInfo pgInfo = new ParamGroupInfo();

			boolean needsBuild = !section.isBuilt();
			if (needsBuild) {
				section.build();
				section.postBuild();
			}

			try {
				Parameter[] paramArray = section.getParamArray();
				List<Parameter> params = new ArrayList<>();
				for (Parameter param : paramArray) {
					if (param instanceof ParameterGroupImpl) {
						params.add(params.size() - ((ParameterGroupImpl) param).size(true),
								param);
					} else {
						params.add(param);
					}
				}

				for (Parameter param : params) {
					String configKeyName = param.getConfigKeyName();
					int i = configKeyName == null ? -1
							: Collections.binarySearch(parameters, configKeyName);

					List<String> tree = null;
					if (i >= 0) {
						tree = new ArrayList<>();
						if (pgInfo.id != null) {
							tree.add(pgInfo.id);
						}
						for (ParamGroupInfo paramGroupInfo : pgInfoStack) {
							if (paramGroupInfo.id == null) {
								continue;
							}
							tree.add(paramGroupInfo.id);
						}
						tree.add(section.getConfigSectionID());
					}

					Map<String, Object> paramAsMap = getParamAsMap(param, pgInfo,
							pgInfoStack, 99);

					if (i >= 0) {
						numParametersLeft--;

						paramAsMap.put("tree", tree);
						String key = (String) paramAsMap.get("key");
						if (key != null) {
							out.put(key, paramAsMap);
						}

						if (numParametersLeft == 0) {
							return;
						}
					}
				}

			} finally {

				if (needsBuild) {
					section.deleteConfigSection();
				}
			}
		}

	}

	static Map<String, Object> getSectionAsMap(BaseConfigSection section,
			int maxUserModeRequested) {
		Map<String, Object> out = new HashMap<>();
		out.put("name", MessageText.getString(section.getSectionNameKey()));
		out.put("id", getFriendlyConfigSectionID(section.getConfigSectionID()));
		out.put("parent-id",
				getFriendlyConfigSectionID(section.getParentSectionID()));
		int minUserMode = section.getMinUserMode();
		int maxUserMode = section.getMaxUserMode();
		if (minUserMode != 0 || maxUserMode != 0) {
			out.put("min-user-mode", minUserMode);
			out.put("max-user-mode", maxUserMode);
		}

		if (maxUserModeRequested >= 0) {
			boolean needsBuild = !section.isBuilt();
			if (needsBuild) {
				section.build();
				section.postBuild();
			}

			Parameter[] paramArray = section.getParamArray();
			List<Parameter> params = new ArrayList<>();
			for (Parameter param : paramArray) {
				if (param instanceof ParameterGroupImpl) {
					params.add(params.size() - ((ParameterGroupImpl) param).size(true),
							param);
				} else {
					params.add(param);
				}
			}

			ParamGroupInfo pgInfo = new ParamGroupInfo();
			List<Map<String, Object>> jsonConfigParams = pgInfo.list;
			out.put("parameters", jsonConfigParams);

			Stack<ParamGroupInfo> pgInfoStack = new Stack<>();

			for (Parameter param : params) {
				getParamAsMap(param, pgInfo, pgInfoStack, maxUserModeRequested);
			}

			if (needsBuild) {
				section.deleteConfigSection();
			}
		}

		return out;
	}

	static void getSections(List<String> sections, Map<String, Object> args,
			Map<String, Object> result) {

		int maxUserMode = MapUtils.getMapInt(args, "max-user-mode",
				Utils.getUserMode());
		if (sections == null || sections.size() == 0) {
			sections = new ArrayList<>();
			sections.add("root");
		}
		List<BaseConfigSection> allConfigSections = ConfigSections.getInstance().getAllConfigSections(
				true);

		result.put("user-mode", Utils.getUserMode());

		Map<String, Object> mapSections = new HashMap<>();
		result.put("sections", mapSections);

		for (String requestedSection : sections) {
			Map<String, Object> jsonSection = new HashMap<>();
			mapSections.put(requestedSection, jsonSection);
			List<Map<String, Object>> listSubSections = null;

			for (BaseConfigSection section : allConfigSections) {
				if (section.getMinUserMode() > maxUserMode) {
					continue;
				}
				String sectionID = getFriendlyConfigSectionID(
						section.getConfigSectionID());

				if (sectionID.equals(requestedSection)) {
					Map<String, Object> sectionAsMap = getSectionAsMap(section,
							maxUserMode);
					jsonSection.putAll(sectionAsMap);
				} else {
					String sectionParentID = getFriendlyConfigSectionID(
							section.getParentSectionID());
					if (sectionParentID.equals(requestedSection)) {
						if (listSubSections == null) {
							listSubSections = new ArrayList<>();
							jsonSection.put("sub-sections", listSubSections);
						}
						listSubSections.add(getSectionAsMap(section, -1));
					}
				}

			}
		}

	}

	private static String listTypeToString(int listType) {
		if (listType == IntListParameter.TYPE_DROPDOWN) {
			return "DropDown";
		}
		if (listType == IntListParameter.TYPE_RADIO_LIST) {
			return "RadioList";
		}
		if (listType == IntListParameter.TYPE_RADIO_COMPACT) {
			return "RadioCompact";
		}
		return null;
	}

	private static class ParamGroupInfo
	{
		boolean enabled = true;

		List<Map<String, Object>> list = new ArrayList<>();

		int numParamsLeft = 1;

		boolean visible = true;

		String id;

		Map<Parameter, List<EnablerParameter>> mapEnableParams = new HashMap<>();

		Map<Parameter, List<EnablerParameter>> mapDisableParams = new HashMap<>();

		public void reset(ParameterGroupImpl pg) {
			this.list = new ArrayList<>();
			this.id = pg.getGroupTitleKey();
			this.visible = pg.isVisible();
			this.enabled = pg.isEnabled();
			this.numParamsLeft = pg.size(false);

			// don't clear enable/disable maps, since we can enable/disable params in different groups
		}

		public ParamGroupInfo() {
		}

		public ParamGroupInfo copy() {
			ParamGroupInfo pgInfo = new ParamGroupInfo();
			pgInfo.set(this);
			return pgInfo;
		}

		public void set(ParamGroupInfo pop) {
			this.list = pop.list;
			this.numParamsLeft = pop.numParamsLeft;
			this.visible = pop.visible;
			this.id = pop.id;
			this.enabled = pop.enabled;
		}

		public boolean isEnabled(Parameter param) {
			boolean isEnabled = param.isEnabled() && enabled;
			List<EnablerParameter> disablerParameters = mapDisableParams.get(param);
			if (disablerParameters != null) {
				for (EnablerParameter p : disablerParameters) {
					isEnabled &= !((Boolean) p.getValueObject());
				}
			}
			List<EnablerParameter> enablerParameters = mapEnableParams.get(param);
			if (enablerParameters != null) {
				for (EnablerParameter p : enablerParameters) {
					isEnabled &= ((Boolean) p.getValueObject());
				}
			}
			return isEnabled;
		}
	}

	private static final class ParameterWithConfigSection
	{
		public String configSection;

		public Parameter parameter;

		public ParameterWithConfigSection(String configSection,
				Parameter parameter) {
			this.configSection = configSection;
			this.parameter = parameter;
		}
	}

	private static class ConfigSections
	{

		private final BaseConfigSection[] internalSections;

		public static ConfigSections getInstance() {
			synchronized (ConfigSections.class) {
				if (instance == null) {
					instance = new ConfigSections();
				}
			}
			return instance;
		}

		public ConfigSections() {
			internalSections = new BaseConfigSection[] {
				new ConfigSectionMode(),
				new ConfigSectionStartShutdown(),
				new ConfigSectionBackupRestore(),
				new ConfigSectionConnection(),
				new ConfigSectionConnectionProxy(),
				new ConfigSectionConnectionAdvanced(),
				new ConfigSectionConnectionEncryption(),
				new ConfigSectionConnectionDNS(),
				new ConfigSectionTransfer(),
				new ConfigSectionTransferAutoSpeedSelect(),
				new ConfigSectionTransferAutoSpeedClassic(),
				new ConfigSectionTransferAutoSpeedV2(),
				new ConfigSectionTransferLAN(),
				new ConfigSectionFile(),
				new ConfigSectionFileMove(),
				new ConfigSectionFileTorrents(),
				new ConfigSectionFileTorrentsDecoding(),
				new ConfigSectionFilePerformance(),
//		  new ConfigSectionInterfaceSWT(),
				new ConfigSectionInterfaceLanguage(),
				new ConfigSectionInterfaceTags(),
//		  new ConfigSectionInterfaceStartSWT(),
//		  new ConfigSectionInterfaceDisplaySWT(),
//		  new ConfigSectionInterfaceTablesSWT(),
//		  new ConfigSectionInterfaceColorSWT(),
//		  new ConfigSectionInterfaceAlertsSWT(),
//		  new ConfigSectionInterfacePasswordSWT(),
//		  new ConfigSectionInterfaceLegacySWT(),
				new ConfigSectionIPFilter(),
				new ConfigSectionPlugins(),
				new ConfigSectionStats(),
				new ConfigSectionTracker(),
				new ConfigSectionTrackerClient(),
				new ConfigSectionTrackerServer(),
				new ConfigSectionSecurity(),
				new ConfigSectionSharing(),
				new ConfigSectionLogging()
			};
		}

		public List<BaseConfigSection> getAllConfigSections(boolean sort) {
			List<BaseConfigSection> repoList = ConfigSectionRepository.getInstance().getList();
			if (!sort) {
				repoList.addAll(0, Arrays.asList(internalSections));
				return repoList;
			}

			ArrayList<BaseConfigSection> configSections = new ArrayList<>(
					Arrays.asList(internalSections));
			// Internal Sections are in the order we want them.  
			// place ones from repository at the bottom of correct parent
			for (BaseConfigSection repoConfigSection : repoList) {
				String repoParentID = repoConfigSection.getParentSectionID();

				int size = configSections.size();
				int insertAt = size;
				for (int i = 0; i < size; i++) {
					BaseConfigSection configSection = configSections.get(i);
					if (insertAt == i) {
						if (!repoParentID.equals(configSection.getParentSectionID())) {
							break;
						}
						insertAt++;
					} else if (configSection.getConfigSectionID().equals(repoParentID)) {
						insertAt = i + 1;
					}
				}
				if (insertAt >= size) {
					configSections.add(repoConfigSection);
				} else {
					configSections.add(insertAt, repoConfigSection);
				}
			}

			return configSections;
		}

	}
}