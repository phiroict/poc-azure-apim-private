cdk_get:
	cdktf get
cdk_deploy:
	cdktf synth && cdktf deploy --auto-approve
cdk_destroy:
	cdktf destroy --auto-approve
