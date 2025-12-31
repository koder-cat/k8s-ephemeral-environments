{{/*
Expand the name of the chart.
*/}}
{{- define "k8s-ee-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
For multi-tenant clusters, includes projectId to prevent collisions.
*/}}
{{- define "k8s-ee-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "app" .Values.nameOverride }}
{{- $projectId := required "projectId is required" .Values.projectId }}
{{- if .Values.prNumber }}
{{- printf "%s-pr-%s-%s" $projectId (.Values.prNumber | toString) $name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" $projectId $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "k8s-ee-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "k8s-ee-app.labels" -}}
helm.sh/chart: {{ include "k8s-ee-app.chart" . }}
{{ include "k8s-ee-app.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.projectId }}
k8s-ee/project-id: {{ .Values.projectId | quote }}
{{- end }}
{{- if .Values.prNumber }}
k8s-ee/pr-number: {{ .Values.prNumber | quote }}
{{- end }}
{{- if .Values.commitSha }}
k8s-ee/commit-sha: {{ .Values.commitSha | quote }}
{{- end }}
{{- if .Values.branchName }}
k8s-ee/branch: {{ .Values.branchName | quote }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "k8s-ee-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "k8s-ee-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Preview URL hostname
For multi-tenant clusters, includes projectId to prevent collisions.
*/}}
{{- define "k8s-ee-app.hostname" -}}
{{- $projectId := required "projectId is required" .Values.projectId }}
{{- if .Values.prNumber }}
{{- printf "%s-pr-%s.%s" $projectId (.Values.prNumber | toString) .Values.previewDomain }}
{{- else }}
{{- printf "%s.%s" $projectId .Values.previewDomain }}
{{- end }}
{{- end }}
